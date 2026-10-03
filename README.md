# Internal Mobility Desk

A lightweight full-stack web application designed for Lawazia to manage bookings, boarding audits, and conflicts for a single Toto (e-rickshaw) shared across campus.

---

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** MongoDB Atlas (official `mongodb` driver)
- **Icons:** `lucide-react`

---

## User Roles

- **Student:** Can request rides for individuals or groups and view their personal trip history.
- **Employee:** Can request rides for individuals or groups and view their personal trip history.
- **Rider:** Operates the single Toto desk, accepts bookings, audits passenger boardings (`Boarded` or `Missed`), handles conflicts, and views all completed trip records.

---

## Main Workflow

```
Request
   │
   ▼
Accept (Toto is held)  ──►  Compromised same-time requests turn to CLASH
   │
   ▼
Pickup (Rider marks each passenger as Boarded or Missed)
   │
   ▼
Complete (Toto is dropped and free again)
   │
   ▼
History (Students see their trips; Rider sees all trips)
```

---

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create `.env.local` in the project root:
   ```env
   MONGODB_URI=your_mongodb_atlas_connection_string
   MONGODB_DB=mobility_desk
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Verify database connection:**
   Visit [http://localhost:3000/api/health](http://localhost:3000/api/health).
