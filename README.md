# Spontaneous Broadcast

## Overview

Spontaneous Broadcast is a modern web application that enables real-time broadcasting capabilities. This project uses a monorepo structure to manage both frontend and backend components efficiently.

## Project Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm (v10 or higher)
- Docker (optional, for containerized development)

### Installation

1. Clone the repository:

bash
git clone https://github.com/yourusername/spontaneous-broadcast.git
cd spontaneous-broadcast

2. Install dependencies:

bash
npm install

3. Create a `.env` file in the root directory with the following variables:

bash
cp .env.example .env

4. Start the development server:

bash
npm run dev

5. Access the application at `http://localhost:3000`

## Project Structure

The project is organized into the following directories:

```
src/
├── controllers/
│ ├── auth.ts
│ └── broadcast.ts
├── middleware/
│ ├── authMiddleware.ts
│ └── rateLimiter.ts
├── models/
│ ├── broadcast.ts
│ └── user.ts
├── routes/
│ ├── auth.ts
│ └── broadcast.ts
├── utils/
│ ├── auth.ts
│ └── broadcast.ts
├── worker/
│ ├── cleanup.ts
│ └── notification.ts
├── zod/
│ ├── auth.ts
│ └── broadcast.ts
└── index.ts
```

## API Documentation

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
