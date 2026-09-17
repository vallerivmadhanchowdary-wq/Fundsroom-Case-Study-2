import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server returned ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(data.message || `API Error: ${response.status}`);
  }

  return data;
}

function App() {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  );
  const [page, setPage] = useState("dashboard");
  const [error, setError] = useState("");

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setPage("login");
  }

  if (!user) {
    return (
      <Login
        onLogin={(data) => {
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          setUser(data.user);
          setPage("dashboard");
        }}
      />
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-box">FR</div>
          <div>
            <h2>Fundsroom</h2>
            <span>ERP System</span>
          </div>
        </div>

        <div className="role-box">
          Logged in as
          <strong>{user.role}</strong>
        </div>

        <nav>
          {[
            ["dashboard", "🏠", "Dashboard"],
            ["customers", "👥", "Customers"],
            ["enquiries", "📋", "Enquiries"],
            ["quotations", "🧾", "Quotations"],
            ["orders", "📦", "Sales Orders"],
            ["inventory", "🏭", "Inventory"],
            ["dispatch", "🚚", "Dispatch"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              className={page === key ? "nav active" : "nav"}
              onClick={() => {
                setError("");
                setPage(key);
              }}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="side-footer">
          Fundsroom Case Study 2
          <br />
          PERN Stack
        </div>
      </aside>

      <main className="main">
        <header>
          <div>
            <h1>Fundsroom ERP</h1>
            <p>Customer to Dispatch Management</p>
          </div>

          <div className="user-area">
            <div className="avatar">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
            <button onClick={logout} className="logout">
              Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        <section className="content">
          {page === "dashboard" && <Dashboard setPage={setPage} />}
          {page === "customers" && <Customers setError={setError} />}
          {page === "enquiries" && <Enquiries setError={setError} />}
          {page === "quotations" && <Quotations setError={setError} />}
          {page === "orders" && <Orders setError={setError} />}
          {page === "inventory" && <Inventory setError={setError} />}
          {page === "dispatch" && <Dispatch setError={setError} />}
        </section>
      </main>
    </div>
  );
}

/* LOGIN */

function Login({ onLogin }) {
  const [email, setEmail] = useState("admin@fundsroom.com");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={login}>
        <div className="login-logo">FR</div>
        <h1>Fundsroom ERP</h1>
        <p>Customer to Dispatch Management</p>

        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="error">{error}</div>}

        <button className="primary full" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <small className="login-help">
          Admin: admin@fundsroom.com / Admin@123
        </small>
      </form>
    </div>
  );
}

/* DASHBOARD */

function Dashboard({ setPage }) {
  const [stats, setStats] = useState({
    customers: 0,
    enquiries: 0,
    quotations: 0,
    orders: 0,
  });

  useEffect(() => {
    async function load() {
      try {
        const [c, e, q, o] = await Promise.all([
          apiRequest("/customers"),
          apiRequest("/enquiries"),
          apiRequest("/quotations"),
          apiRequest("/sales-orders"),
        ]);

        setStats({
          customers: c.customers?.length || 0,
          enquiries: e.enquiries?.length || 0,
          quotations: q.quotations?.length || 0,
          orders: o.salesOrders?.length || 0,
        });
      } catch {}
    }

    load();
  }, []);

  return (
    <>
      <div className="page-title">
        <h2>Dashboard</h2>
        <p>Welcome to Fundsroom ERP</p>
      </div>

      <div className="stats">
        <Stat title="Customers" value={stats.customers} icon="👥" />
        <Stat title="Enquiries" value={stats.enquiries} icon="📋" />
        <Stat title="Quotations" value={stats.quotations} icon="🧾" />
        <Stat title="Sales Orders" value={stats.orders} icon="📦" />
      </div>

      <div className="workflow">
        <h2>Business Workflow</h2>

        <div className="workflow-row">
          <Step number="01" title="Enquiry" />
          <b>→</b>
          <Step number="02" title="Quotation" />
          <b>→</b>
          <Step number="03" title="Sales Order" />
          <b>→</b>
          <Step number="04" title="Dispatch" />
        </div>
      </div>

      <div className="quick-actions">
        <button onClick={() => setPage("customers")}>
          + Add Customer
        </button>
        <button onClick={() => setPage("enquiries")}>
          + New Enquiry
        </button>
        <button onClick={() => setPage("inventory")}>
          View Inventory
        </button>
      </div>
    </>
  );
}

function Stat({ title, value, icon }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function Step({ number, title }) {
  return (
    <div className="step">
      <small>{number}</small>
      <strong>{title}</strong>
    </div>
  );
}

/* CUSTOMERS */

function Customers({ setError }) {
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    mobile: "",
    email: "",
    city: "",
  });

  async function load() {
    try {
      const data = await apiRequest("/customers");
      setCustomers(data.customers || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createCustomer(e) {
    e.preventDefault();

    try {
      await apiRequest("/customers", {
        method: "POST",
        body: JSON.stringify(form),
      });

      setForm({
        companyName: "",
        contactPerson: "",
        mobile: "",
        email: "",
        city: "",
      });

      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <PageTitle
        title="Customers"
        subtitle="Manage customer information"
        button="+ Add Customer"
        onClick={() => setShowForm(!showForm)}
      />

      {showForm && (
        <form className="form-card" onSubmit={createCustomer}>
          <h2>Add Customer</h2>

          <div className="form-grid">
            <input
              placeholder="Company Name"
              required
              value={form.companyName}
              onChange={(e) =>
                setForm({ ...form, companyName: e.target.value })
              }
            />

            <input
              placeholder="Contact Person"
              required
              value={form.contactPerson}
              onChange={(e) =>
                setForm({ ...form, contactPerson: e.target.value })
              }
            />

            <input
              placeholder="Mobile"
              required
              value={form.mobile}
              onChange={(e) =>
                setForm({ ...form, mobile: e.target.value })
              }
            />

            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />

            <input
              placeholder="City"
              required
              value={form.city}
              onChange={(e) =>
                setForm({ ...form, city: e.target.value })
              }
            />
          </div>

          <button className="primary">Create Customer</button>
        </form>
      )}

      <Table
        headers={["Company", "Contact", "Mobile", "Email", "City"]}
        rows={customers.map((c) => [
          c.companyName,
          c.contactPerson,
          c.mobile,
          c.email || "-",
          c.city,
        ])}
      />
    </>
  );
}

/* ENQUIRIES */

function Enquiries({ setError }) {
  const [enquiries, setEnquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [show, setShow] = useState(false);

  const [form, setForm] = useState({
    customerId: "",
    enquiryDate: new Date().toISOString().slice(0, 10),
    requiredDate: "",
    productId: "",
    quantity: 1,
    notes: "",
  });

  async function load() {
    try {
      const [e, c, i] = await Promise.all([
        apiRequest("/enquiries"),
        apiRequest("/customers"),
        apiRequest("/inventory"),
      ]);

      setEnquiries(e.enquiries || []);
      setCustomers(c.customers || []);
      setInventory(i.inventory || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();

    try {
      await apiRequest("/enquiries", {
        method: "POST",
        body: JSON.stringify({
          customerId: Number(form.customerId),
          enquiryDate: form.enquiryDate,
          requiredDate: form.requiredDate,
          items: [
            {
              productId: Number(form.productId),
              quantity: Number(form.quantity),
            },
          ],
          notes: form.notes,
        }),
      });

      setShow(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <PageTitle
        title="Enquiries"
        subtitle="Create and manage customer enquiries"
        button="+ New Enquiry"
        onClick={() => setShow(!show)}
      />

      {show && (
        <form className="form-card" onSubmit={create}>
          <h2>New Enquiry</h2>

          <select
            required
            value={form.customerId}
            onChange={(e) =>
              setForm({ ...form, customerId: e.target.value })
            }
          >
            <option value="">Select Customer</option>
            {customers.map((c) => (
              <option value={c.id} key={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>

          <div className="form-grid">
            <div>
              <label>Enquiry Date</label>
              <input
                type="date"
                required
                value={form.enquiryDate}
                onChange={(e) =>
                  setForm({ ...form, enquiryDate: e.target.value })
                }
              />
            </div>

            <div>
              <label>Required Date</label>
              <input
                type="date"
                required
                value={form.requiredDate}
                onChange={(e) =>
                  setForm({ ...form, requiredDate: e.target.value })
                }
              />
            </div>

            <select
              required
              value={form.productId}
              onChange={(e) =>
                setForm({ ...form, productId: e.target.value })
              }
            >
              <option value="">Select Product</option>
              {inventory.map((i) => (
                <option value={i.productId} key={i.productId}>
                  {i.product.code} - {i.product.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              required
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: e.target.value })
              }
            />
          </div>

          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(e) =>
              setForm({ ...form, notes: e.target.value })
            }
          />

          <button className="primary">Create Enquiry</button>
        </form>
      )}

      <Table
        headers={["Enquiry No.", "Customer", "Date", "Required", "Status"]}
        rows={enquiries.map((e) => [
          e.enquiryNumber,
          e.customer?.companyName,
          new Date(e.enquiryDate).toLocaleDateString(),
          new Date(e.requiredDate).toLocaleDateString(),
          e.status,
        ])}
      />
    </>
  );
}

/* QUOTATIONS */

function Quotations({ setError }) {
  const [quotations, setQuotations] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [show, setShow] = useState(false);

  const [form, setForm] = useState({
    enquiryId: "",
    productId: "",
    quantity: 1,
    unitPrice: "",
    discountPercent: 0,
    gstPercent: 18,
    validUntil: "",
  });

  async function load() {
    try {
      const [q, e, i] = await Promise.all([
        apiRequest("/quotations"),
        apiRequest("/enquiries"),
        apiRequest("/inventory"),
      ]);

      setQuotations(q.quotations || []);
      setEnquiries(e.enquiries || []);
      setInventory(i.inventory || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();

    try {
      await apiRequest("/quotations", {
        method: "POST",
        body: JSON.stringify({
          enquiryId: Number(form.enquiryId),
          validUntil: form.validUntil,
          items: [
            {
              productId: Number(form.productId),
              quantity: Number(form.quantity),
              unitPrice: Number(form.unitPrice),
              discountPercent: Number(form.discountPercent),
              gstPercent: Number(form.gstPercent),
            },
          ],
        }),
      });

      setShow(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function status(id, value) {
    try {
      await apiRequest(`/quotations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: value }),
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function convert(id) {
    try {
      await apiRequest(`/quotations/${id}/convert`, {
        method: "POST",
      });
      load();
      alert("Sales Order created successfully");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <PageTitle
        title="Quotations"
        subtitle="Create and manage quotations"
        button="+ New Quotation"
        onClick={() => setShow(!show)}
      />

      {show && (
        <form className="form-card" onSubmit={create}>
          <h2>New Quotation</h2>

          <select
            required
            value={form.enquiryId}
            onChange={(e) =>
              setForm({ ...form, enquiryId: e.target.value })
            }
          >
            <option value="">Select Enquiry</option>
            {enquiries
              .filter((e) => e.status !== "LOST")
              .map((e) => (
                <option value={e.id} key={e.id}>
                  {e.enquiryNumber} - {e.customer?.companyName}
                </option>
              ))}
          </select>

          <div className="form-grid">
            <select
              required
              value={form.productId}
              onChange={(e) =>
                setForm({ ...form, productId: e.target.value })
              }
            >
              <option value="">Select Product</option>
              {inventory.map((i) => (
                <option value={i.productId} key={i.productId}>
                  {i.product.code} - {i.product.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              placeholder="Quantity"
              required
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: e.target.value })
              }
            />

            <input
              type="number"
              placeholder="Unit Price"
              required
              value={form.unitPrice}
              onChange={(e) =>
                setForm({ ...form, unitPrice: e.target.value })
              }
            />

            <input
              type="number"
              min="0"
              max="100"
              placeholder="Discount %"
              value={form.discountPercent}
              onChange={(e) =>
                setForm({ ...form, discountPercent: e.target.value })
              }
            />

            <input
              type="number"
              min="0"
              max="100"
              placeholder="GST %"
              value={form.gstPercent}
              onChange={(e) =>
                setForm({ ...form, gstPercent: e.target.value })
              }
            />

            <input
              type="date"
              required
              value={form.validUntil}
              onChange={(e) =>
                setForm({ ...form, validUntil: e.target.value })
              }
            />
          </div>

          <button className="primary">Create Quotation</button>
        </form>
      )}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Quotation</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {quotations.map((q) => (
              <tr key={q.id}>
                <td>{q.quotationNumber}</td>
                <td>{q.customer?.companyName}</td>
                <td>₹ {q.totalAmount}</td>
                <td>
                  <span className="badge">{q.status}</span>
                </td>
                <td>
                  {q.status === "DRAFT" && (
                    <button
                      className="small-btn"
                      onClick={() => status(q.id, "SENT")}
                    >
                      Send
                    </button>
                  )}

                  {q.status === "SENT" && (
                    <>
                      <button
                        className="small-btn success"
                        onClick={() => status(q.id, "ACCEPTED")}
                      >
                        Accept
                      </button>

                      <button
                        className="small-btn danger"
                        onClick={() => status(q.id, "REJECTED")}
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {q.status === "ACCEPTED" && !q.salesOrder && (
                    <button
                      className="small-btn"
                      onClick={() => convert(q.id)}
                    >
                      Create Order
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* SALES ORDERS */

function Orders({ setError }) {
  const [orders, setOrders] = useState([]);

  async function load() {
    try {
      const data = await apiRequest("/sales-orders");
      setOrders(data.salesOrders || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function confirm(id) {
    try {
      await apiRequest(`/sales-orders/${id}/confirm`, {
        method: "POST",
      });

      load();
      alert("Order confirmed and inventory reserved");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <PageTitle
        title="Sales Orders"
        subtitle="Manage sales orders and inventory reservation"
      />

      <Table
        headers={["Order", "Customer", "Total", "Status", "Action"]}
        rows={orders.map((o) => [
          o.orderNumber,
          o.customer?.companyName,
          `₹ ${o.totalAmount}`,
          o.status,
          o.status === "PENDING" ? (
            <button
              className="small-btn"
              onClick={() => confirm(o.id)}
            >
              Confirm
            </button>
          ) : (
            "-"
          ),
        ])}
      />
    </>
  );
}

/* INVENTORY */

function Inventory({ setError }) {
  const [inventory, setInventory] = useState([]);

  async function load() {
    try {
      const data = await apiRequest("/inventory");
      setInventory(data.inventory || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <PageTitle
        title="Inventory"
        subtitle="Physical, reserved and available stock"
      />

      <Table
        headers={[
          "Product",
          "Code",
          "Category",
          "Physical",
          "Reserved",
          "Available",
        ]}
        rows={inventory.map((i) => [
          i.product?.name,
          i.product?.code,
          i.product?.category,
          i.physicalQuantity,
          i.reservedQuantity,
          i.availableQuantity,
        ])}
      />
    </>
  );
}

/* DISPATCH */

function Dispatch({ setError }) {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState("");

  const [form, setForm] = useState({
    vehicleNumber: "",
    driverName: "",
  });

  async function load() {
    try {
      const data = await apiRequest("/sales-orders");
      setOrders(
        (data.salesOrders || []).filter(
          (o) => o.status === "CONFIRMED"
        )
      );
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const order = orders.find((o) => String(o.id) === String(selected));

  async function dispatch() {
    if (!order) {
      setError("Please select a confirmed order");
      return;
    }

    try {
      await apiRequest(`/sales-orders/${order.id}/dispatch`, {
        method: "POST",
        body: JSON.stringify({
          vehicleNumber: form.vehicleNumber,
          driverName: form.driverName,
          items: order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      });

      alert("Dispatch completed successfully");

      setSelected("");
      setForm({
        vehicleNumber: "",
        driverName: "",
      });

      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <PageTitle
        title="Dispatch"
        subtitle="Process confirmed sales orders"
      />

      <div className="form-card">
        <h2>Create Dispatch</h2>

        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select Confirmed Order</option>

          {orders.map((o) => (
            <option value={o.id} key={o.id}>
              {o.orderNumber} - {o.customer?.companyName}
            </option>
          ))}
        </select>

        <div className="form-grid">
          <input
            placeholder="Vehicle Number"
            value={form.vehicleNumber}
            onChange={(e) =>
              setForm({
                ...form,
                vehicleNumber: e.target.value,
              })
            }
          />

          <input
            placeholder="Driver Name"
            value={form.driverName}
            onChange={(e) =>
              setForm({
                ...form,
                driverName: e.target.value,
              })
            }
          />
        </div>

        {order && (
          <div className="selected-order">
            <strong>{order.orderNumber}</strong>

            {order.items?.map((item) => (
              <p key={item.id}>
                {item.product?.name || `Product ${item.productId}`} —
                Quantity: {item.quantity}
              </p>
            ))}
          </div>
        )}

        <button
          className="primary"
          onClick={dispatch}
          disabled={!order}
        >
          🚚 Dispatch Order
        </button>
      </div>
    </>
  );
}

/* COMMON COMPONENTS */

function PageTitle({ title, subtitle, button, onClick }) {
  return (
    <div className="page-title">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      {button && (
        <button className="primary" onClick={onClick}>
          {button}
        </button>
      )}
    </div>
  );
}

function Table({ headers, rows }) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="empty">
                No records found
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;