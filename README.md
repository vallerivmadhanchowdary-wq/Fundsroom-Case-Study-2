# Fundsroom ERP - Case Study 2

A full-stack ERP application developed as part of the Fundsroom Full-Stack Developer Technical Case Study.

The application manages the complete business workflow:

**Customer → Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch**

---

## Tech Stack

### Frontend
- React.js
- Vite
- JavaScript
- CSS

### Backend
- Node.js
- Express.js
- TypeScript
- REST APIs
- JWT Authentication
- Role-Based Access Control

### Database
- PostgreSQL
- Prisma ORM

---

## Features

### Authentication
- User login using email and password
- JWT-based authentication
- Protected APIs
- Role-based authorization

### User Roles

#### ADMIN
- View customers and enquiries
- Manage inventory
- Confirm sales orders
- Process dispatch
- Manage administrative operations

#### SALES
- Create and view customers
- Create enquiries
- Create quotations
- Convert accepted quotations into sales orders
- View inventory availability

---

## Business Workflow

### 1. Customer

Customer information includes:

- Company name
- Contact person
- Mobile number
- Email
- City

---

### 2. Enquiry

An enquiry contains:

- Enquiry number
- Customer
- Enquiry date
- Required date
- Products
- Quantities
- Notes
- Status

Enquiry statuses:

```text
NEW → QUOTED → WON / LOST
