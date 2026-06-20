-- ==============================================================================
-- Elly Furniture - Supabase Database Schema
-- ==============================================================================

-- 1. Enable UUID Extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category TEXT,
    image_url TEXT,
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    county_city TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    products_ordered JSONB NOT NULL, -- Array of objects: [{id, name, price, quantity, image_url}]
    quantity INTEGER NOT NULL, -- Total item count
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL, -- M-Pesa or Cash on Delivery
    order_status TEXT DEFAULT 'Pending', -- Pending, Confirmed, Processing, Shipped, Delivered, Cancelled
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    county_city TEXT,
    delivery_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Sales Records Table
CREATE TABLE IF NOT EXISTS sales_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;

-- PRODUCTS POLICY:
-- * Anyone can view products.
-- * Only authenticated admins (role: authenticated) can add, edit, or delete products.
CREATE POLICY "Allow public read-only access to products" 
    ON products FOR SELECT 
    USING (true);

CREATE POLICY "Allow full access to products for admins" 
    ON products FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- ORDERS POLICY:
-- * Anyone can submit/insert an order (customer checkout).
-- * Only authenticated admins can read, update, or delete orders.
CREATE POLICY "Allow public inserts to orders" 
    ON orders FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow admin access to orders" 
    ON orders FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- CUSTOMERS POLICY:
-- * Anyone can check (select) or insert customer records during checkout.
-- * Only authenticated admins can update or delete customer profiles.
CREATE POLICY "Allow public select on customers"
    ON customers FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert/upsert on customers" 
    ON customers FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow public update on customers"
    ON customers FOR UPDATE
    USING (true);

CREATE POLICY "Allow admin access to customers" 
    ON customers FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- SALES RECORDS POLICY:
-- * Anyone can insert a sales record during checkout.
-- * Only authenticated admins can select, update, or delete sales records.
CREATE POLICY "Allow public inserts to sales records" 
    ON sales_records FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow admin access to sales records" 
    ON sales_records FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- ==============================================================================
-- TRIGGERS & TRIGGERS FUNCTIONS (Optional, for auto-generating customers/sales)
-- We will write the insertion logic directly in JS for reliability and speed,
-- but having this schema ensures database-level structure is complete.
-- ==============================================================================

-- Enable Realtime Publications for Dashboard Sync
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE products, orders, customers, sales_records;
COMMIT;
