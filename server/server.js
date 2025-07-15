import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import colors from 'colors';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

// Database and Routes
import connectDB from './config/database.js';
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

// ES Modules path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment config
dotenv.config();

// Initialize Express
const app = express();

// Security Middleware
app.use(helmet());
app.use(mongoSanitize());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://mern-ecommerce-pgsp.onrender.com'] 
    : 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per window
});
app.use(limiter);

// Dev logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parser
app.use(express.json());

// Routes
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);

// PayPal config
app.use('/api/config/paypal', (req, res) =>
  res.send(process.env.PAYPAL_CLIENT_ID)
);

// Uploads directory
const uploadsPath = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath));
} else {
  console.warn('Uploads directory not found - file uploads will not work');
}

// Production setup
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
  
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(clientBuildPath, 'index.html'));
    });
  } else {
    console.warn('Client build not found - run "npm run build" in client directory');
  }
} else {
  // API status check
  app.get('/', (req, res) => {
    res.json({
      status: 'API is running',
      documentation: 'http://localhost:5000/api-docs'
    });
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Server initialization
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(
        `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow
          .bold
      );
    });
  } catch (error) {
    console.error('Failed to connect to database:'.red.bold, error.message);
    process.exit(1);
  }
};

startServer();
