# AIleana Payments & Calls API

This is the backend service for AIleana, a demo application for wallet management, payment processing, and call session tracking.

## Prerequisites

- Node.js (v14 or later)
- A PostgreSQL database (e.g., from Supabase or a local installation)

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

3.  **Set up the database:**
    -   Connect to your PostgreSQL database.
    -   Execute the SQL commands in the `schema.sql` file to create the necessary tables.

4.  **Configure environment variables:**
    -   Rename the `.env.example` file to `.env`.
    -   Open the `.env` file and update the following variables with your actual credentials:
        -   `DATABASE_URL`: Your full PostgreSQL connection string.
        -   `JWT_SECRET`: A long, random, and secret string for signing JWTs.
        -   `PORT`: The port on which you want the server to run (defaults to 3000).

## Running the Server

Once you have completed the setup, you can start the server with the following command:

```bash
npm start
```

The API will be running at `http://localhost:3000` (or your configured port).

## API Endpoints

The API provides endpoints for:

-   **Authentication:** `/api/auth/register`, `/api/auth/login`
-   **Wallet & Payments:** `/api/wallet`, `/api/wallet/fund`, `/api/wallet/webhook`, `/api/wallet/transactions`
-   **Calls:** `/api/calls/initiate`, `/api/calls/:call_id/answer`, `/api/calls/:call_id/end`, `/api/calls/history`, `/api/calls/:call_id`

Refer to the provided Product Requirements Document (PRD) for detailed information on each endpoint's request and response formats.
