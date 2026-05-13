module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
  });
};
