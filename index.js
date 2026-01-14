const express = require('express');
const config = require('./src/config');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const walletRoutes = require('./src/routes/walletRoutes');
const callRoutes = require('./src/routes/callRoutes');

const app = express();

// Middleware
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/calls', callRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.send('AIleana Payments & Calls API is running...');
});

// Global error handler for JSON parsing errors
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid JSON payload'
            }
        });
    }
    next();
});


const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
