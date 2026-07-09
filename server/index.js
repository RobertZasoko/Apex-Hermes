
const express = require('express');
const admin = require('firebase-admin');
const paypal = require('@paypal/checkout-server-sdk');

// --- Service Account Initialization ---
// When running in a Google Cloud environment, the SDK can automatically
// find the service account credentials. No need to specify the file path.
admin.initializeApp();
// --- End Initialization ---


// --- PayPal Client Setup ---
// Get PayPal credentials from environment variables. These must be configured in your Cloud Run service.
const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("FATAL ERROR: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set as environment variables.");
  process.exit(1);
}

// Set up the PayPal environment. Using LiveEnvironment for production.
const environment = new paypal.core.LiveEnvironment(clientId, clientSecret);
const client = new paypal.core.PayPalHttpClient(environment);
// --- End PayPal Client Setup ---


const app = express();

// We need the raw request body for webhook signature verification.
// The 'verify' function of express.json() gives us the raw buffer.
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));


const PORT = process.env.PORT || 8080;

// --- Plan IDs from PayPal ---
const PLAN_IDS = {
  founders: {
    monthly: 'P-3JB06326BS156752JNEXMZAQ', // Example live ID, replace if needed
    yearly: 'P-0PR251885A973920VNEXMZRQ', // Example live ID, replace if needed
  },
  pro: {
    monthly: 'P-1SJ97502J6029610GNEXMXIY', // Example live ID, replace if needed
    yearly: 'P-4VH9625877356522KNEXMYLA', // Example live ID, replace if needed
  }
};


// --- Main Webhook Endpoint ---
app.post('/webhook', async (req, res) => {
  console.log("Webhook received!");

  // --- Step 1: PayPal Signature Verification ---
  const webhookId = process.env.PAYPAL_WEBHOOK_ID; // Get from environment variables
  if (!webhookId) {
      console.error("Webhook ID not configured.");
      return res.status(500).send("Webhook not configured.");
  }

  const request = new paypal.webhooks.VerifyWebhookSignatureRequest();
  request.authAlgo(req.headers['paypal-auth-algo']);
  request.certUrl(req.headers['paypal-cert-url']);
  request.transmissionId(req.headers['paypal-transmission-id']);
  request.transmissionSig(req.headers['paypal-transmission-sig']);
  request.transmissionTime(req.headers['paypal-transmission-time']);
  request.webhookId(webhookId);
  request.requestBody(req.rawBody);

  try {
    const verificationResult = await client.execute(request);
    if (verificationResult.result.verification_status !== 'SUCCESS') {
      console.error('Webhook signature verification failed.');
      return res.sendStatus(403); // Forbidden
    }
    console.log("Webhook signature verified successfully.");
  } catch (err) {
    console.error("Error verifying webhook signature:", err);
    return res.sendStatus(400);
  }
  // --- End Verification ---


  // --- Step 2: Process the Verified Event ---
  const event = req.body;
  const eventType = event.event_type;
  const resource = event.resource;

  console.log(`Processing event type: ${eventType}`);

  // --- Handle Subscription Activation ---
  if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
    const userId = resource.custom_id;
    const planId = resource.plan_id;

    if (!userId) {
      console.error("Missing custom_id (userId) in ACTIVATED event.");
      return res.status(400).send("Bad Request: Missing userId.");
    }

    let subscriptionStatus = 'pro'; // Default to pro

    try {
      const userRef = admin.firestore().collection('users').doc(userId);
      await userRef.update({ subscriptionStatus: subscriptionStatus });
      console.log(`Successfully updated user ${userId} to ${subscriptionStatus}`);
    } catch (error) {
      console.error(`Failed to update user ${userId}:`, error);
      return res.status(500).send('Internal Server Error.');
    }
  }

  // --- Handle Subscription Cancellation/Expiration ---
  else if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.EXPIRED') {
    const userId = resource.custom_id;
    if (!userId) {
        console.error("Missing custom_id (userId) in CANCELLED/EXPIRED event.");
        return res.status(400).send("Bad Request: Missing userId.");
    }

    try {
        const userRef = admin.firestore().collection('users').doc(userId);
        await userRef.update({ subscriptionStatus: 'free' });
        console.log(`Successfully reverted subscription for user ${userId} to 'free'.`);
    } catch (error) {
        console.error(`Failed to revert subscription for user ${userId}:`, error);
        return res.status(500).send('Internal Server Error.');
    }
  }

  res.status(200).send('Webhook processed.');
});


app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
