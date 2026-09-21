function createCompanyAdminMiddleware(supabaseAdmin) {
  return async function requireCompanyAdmin(req, res, next) {
    const companyId = String(req.headers['x-company-id'] || '').trim();
    if (!companyId) {
      return res.status(400).json({ error: { type: 'invalid_request', message: 'Company context is required.' } });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ error: { type: 'server_error', message: 'Control Tower proxy is not configured.' } });
    }
    try {
      const { data, error } = await supabaseAdmin
        .from('mt_users_companies')
        .select('role')
        .eq('user_id', req.user.id)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .eq('role', 'admin')
        .maybeSingle();
      if (error) {
        console.error('[CONTROL TOWER] company-admin lookup failed:', error.message);
        return res.status(503).json({ error: { type: 'server_error', message: 'Could not verify settings access.' } });
      }
      if (!data) {
        return res.status(403).json({ error: { type: 'forbidden', message: 'You do not have permission to manage settings for this company.' } });
      }
      req.companyId = companyId;
      next();
    } catch (error) {
      console.error('[CONTROL TOWER] company-admin lookup exception:', error.message);
      return res.status(503).json({ error: { type: 'server_error', message: 'Could not verify settings access.' } });
    }
  };
}

module.exports = { createCompanyAdminMiddleware };
