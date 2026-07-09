import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

// Define the structure of the incoming PayPal webhook event
interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: {
    id: string;
    plan_id: string;
    custom_id?: string; // Contains our userId
  };
}

// TODO: Replace with your actual LIVE Plan IDs from your PayPal Developer Dashboard.
const PLAN_IDS = {
  founders: {
    monthly: 'P-6UM03357YN1341257NEUICL',
    yearly: 'P-5LG43274Y03826612NEUWCSA',
  },
  pro: {
    monthly: 'P-4X322311BS384323TNEUIDJY',
    yearly: 'P-8GP79925K4292331XNEUWDQA',
  },
};

/**
 * Handles incoming webhooks from PayPal to manage subscriptions.
 */
export const paypalWebhook = functions.https.onRequest(async (request, response) => {
  // 1. Verify the webhook signature to ensure it's from PayPal
  // TODO: Add PayPal webhook verification logic here.

  // 2. Process only the BILLING.SUBSCRIPTION.ACTIVATED event
  const event = request.body as PayPalWebhookEvent;
  if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED") {
    const userId = event.resource.custom_id;
    const planId = event.resource.plan_id;

    if (!userId) {
      response.status(400).send("Bad Request: Missing custom_id (userId).");
      return;
    }

    let subscriptionStatus: 'founders' | 'pro' | undefined;

    // 3. Determine the subscription status based on the PayPal Plan ID
    if ([PLAN_IDS.founders.monthly, PLAN_IDS.founders.yearly].includes(planId)) {
      subscriptionStatus = "founders";
    } else if ([PLAN_IDS.pro.monthly, PLAN_IDS.pro.yearly].includes(planId)) {
      subscriptionStatus = "pro";
    }

    if (!subscriptionStatus) {
      response.status(400).send(`Bad Request: Unrecognized Plan ID: ${planId}`);
      return;
    }

    // 4. Update the user's profile in Firestore
    try {
      await admin.firestore().collection("users").doc(userId).update({
        subscriptionStatus: subscriptionStatus,
      });
      console.log(`Successfully updated user ${userId} to ${subscriptionStatus}`);
      response.status(200).send("Webhook processed successfully.");
    } catch (error) {
      console.error(`Failed to update user ${userId}:`, error);
      response.status(500).send("Internal Server Error: Failed to update user profile.");
    }
  } else {
    // Acknowledge other webhook events without taking action
    response.status(200).send("Webhook received, but no action taken.");
  }
});
