app.post("/press", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { userName } = req.body;

    if (!userName) {
      return res.status(400).json({ error: "userName is required" });
    }

    await conn.beginTransaction();

    // Lock row for this user
    const [userRows] = await conn.execute(
      "SELECT is_pressed FROM qb_users WHERE user_name = ? FOR UPDATE",
      [userName]
    );

    if (userRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "User not found" });
    }

    if (userRows[0].is_pressed === 1) {
      await conn.rollback();
      return res.status(409).json({ error: "Already pressed" });
    }

    // Lock entire pressed set to safely get next order
    const [orderRows] = await conn.execute(
      "SELECT COALESCE(MAX(press_order), 0) AS maxOrder FROM qb_users WHERE is_pressed = 1 FOR UPDATE"
    );

    const nextOrder = orderRows[0].maxOrder + 1;

    await conn.execute(
      `UPDATE qb_users
       SET is_pressed = 1,
           press_order = ?,
           press_time = NOW()
       WHERE user_name = ?`,
      [nextOrder, userName]
    );

    await conn.commit();

    await emitUsersUpdate();
    return res.status(200).json({
      success: true,
      pressOrder: nextOrder,
    });

  } catch (err) {
    await conn.rollback();
    console.error("PRESS ERROR:", err);
    return res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});
