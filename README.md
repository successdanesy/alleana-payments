# AIleana Payments & Calls API

This is the backend service for AIleana, a demo application for wallet management, payment processing, and call session tracking.

## Prerequisites

- Node.js (v14 or later)
- Postman (for API testing)

## Installation & Setup

1.  **Clone the repository (or download the code):**
    ```bash
    git clone <repository_url>
    cd alleana-payments
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure environment variables:**
    -   Rename the `.env.example` file to `.env`.
    -   Open the `.env` file and update the `JWT_SECRET` variable with a long, random, and secret string for signing JWTs.
    -   The `PORT` variable configures the port on which the server will run (defaults to 3000).

## Running the Server

Once you have completed the setup, you can start the server with the following command:

```bash
npm start
```

The API will be running at `http://localhost:3000` (or your configured port).
**Note:** This application uses an in-memory data store. All data (users, wallets, calls) will reset every time the server is restarted.

## API Endpoints

The API provides endpoints for:

-   **Authentication:** `/api/auth/register`, `/api/auth/login`
-   **Wallet & Payments:** `/api/wallet`, `/api/wallet/fund`, `/api/wallet/webhook`, `/api/wallet/transactions`
-   **Calls:** `/api/calls/initiate`, `/api/calls/:call_id/answer`, `/api/calls/:call_id/end`, `/api/calls/history`, `/api/calls/:call_id`

## Testing with Postman

This section guides you through testing the API using Postman.

### Step 1: Setup Postman Environment

To make testing easier, we'll use a Postman Environment to store variables like the server address, user tokens, and IDs.

1.  In Postman, click the **"Environments"** tab on the left, then click the `+` button to create a new one. Name it "AIleana API".
2.  Add your first variable:
    *   **Variable:** `base_url`
    *   **Initial Value:** `http://localhost:3000`
3.  Save the environment (Ctrl/Cmd + S) and make sure it's selected in the top-right dropdown menu in Postman.

### Step 2: Register Two Users

We need two users to simulate a call: a caller (User A) and a receiver (User B).

#### Register User A

1.  Create a new request (`+` button).
2.  Set the method to **POST**.
3.  Enter the URL: `{{base_url}}/api/auth/register`
4.  Go to the **"Body"** tab, select **"raw"** and **"JSON"**. Paste the following:
    ```json
    {
      "email": "usera@example.com",
      "password": "password123",
      "full_name": "User A"
    }
    ```
5.  Click **"Send"**. You should get a `201 Created` response containing a `token` and user `id`.
6.  **Save the Token and ID:** In the response window, highlight the `token` value, right-click, and select `Set: AIleana API > Set as new variable`. Name it `user_a_token`. Do the same for the `id` value and name it `user_a_id`.

#### Register User B

1.  Duplicate the previous request tab.
2.  Change the body to:
    ```json
    {
      "email": "userb@example.com",
      "password": "password456",
      "full_name": "User B"
    }
    ```
3.  Click **"Send"**.
4.  From this response, save the `id` as a new environment variable named `user_b_id`.

### Step 3: Fund User A's Wallet

Calls cost money, so we need to fund User A's wallet. This is a two-step process.

#### Part 1: Initiate Funding

1.  Create a new request: **POST** `{{base_url}}/api/wallet/fund`
2.  Go to the **"Authorization"** tab, select **"Bearer Token"**, and paste `{{user_a_token}}` in the token field.
3.  Go to the **"Body"** tab (raw, JSON) and add the amount:
    ```json
    {
      "amount": 500
    }
    ```
4.  Click **"Send"**.
5.  From the `200 OK` response, save the `reference` value as a variable named `transaction_reference`.

#### Part 2: Simulate Payment Webhook

1.  Create a new request: **POST** `{{base_url}}/api/wallet/webhook`
2.  This is a public endpoint, so no authorization is needed.
3.  In the **"Body"** (raw, JSON), simulate the payment provider's confirmation:
    ```json
    {
      "reference": "{{transaction_reference}}",
      "status": "PAID",
      "amount": 500
    }
    ```
4.  Click **"Send"**. You should get a `200 OK` with the message "Payment confirmed".

#### Verify Balance

1.  Create a new request: **GET** `{{base_url}}/api/wallet`
2.  Set **Authorization** to **Bearer Token** `{{user_a_token}}`.
3.  Click **"Send"**. The response should show User A's balance is now `500.00`.

### Step 4: Make a Call

Now let's simulate the call from User A to User B.

#### 1. User A Initiates the Call

1.  Create a new request: **POST** `{{base_url}}/api/calls/initiate`
2.  Set **Authorization** to **Bearer Token** `{{user_a_token}}`.
3.  In the **"Body"** (raw, JSON), specify User B as the receiver:
    ```json
    {
      "receiver_id": "{{user_b_id}}"
    }
    ```
4.  Click **"Send"**. The response will show the call status as `initiated`.
5.  From the response, save the `call_id` as a variable named `call_id`.

#### 2. User B Answers the Call

To answer, User B needs their own token. Let's log them in.

1.  Create a login request: **POST** `{{base_url}}/api/auth/login`
2.  Body:
    ```json
    {
        "email": "userb@example.com",
        "password": "password456"
    }
    ```
3.  From the response, save the `token` as `user_b_token`.

Now, have User B answer:
1.  Create a new request: **PATCH** `{{base_url}}/api/calls/{{call_id}}/answer`
2.  Set **Authorization** to **Bearer Token** `{{user_b_token}}`. (This is important—only the receiver can answer).
3.  Click **"Send"**. The call status will change to `ongoing`.

#### 3. End the Call

Either user can end the call. Let's have User A do it.

1.  Create a new request: **PATCH** `{{base_url}}/api/calls/{{call_id}}/end`
2.  Set **Authorization** to **Bearer Token** `{{user_a_token}}`.
3.  In the **"Body"** (raw, JSON), provide a reason:
    ```json
    {
      "reason": "caller_hangup"
    }
    ```
4.  Click **"Send"**. You'll get a response with the final duration and total charge.

### Step 5: Final Verification

1.  **Check User A's Final Balance:** Rerun the **GET** `/api/wallet` request from earlier (with User A's token). The balance should be `450.00` (assuming a 1-minute call at ₦50/min).
2.  **Check User A's Transactions:**
    *   Create a new request: **GET** `{{base_url}}/api/wallet/transactions`
    *   Set **Authorization** to **Bearer Token** `{{user_a_token}}`.
    *   Click **"Send"**. You will now see two transactions: the initial deposit and the `call_charge`.

This flow covers the main functionality of the API. You can continue testing other scenarios like insufficient funds, trying to call yourself, or fetching call history.