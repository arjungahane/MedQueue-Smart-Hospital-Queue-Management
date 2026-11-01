export function notFound(req, res) {
  res.status(404).json({ error: 'The requested resource was not found.' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === 'ZodError') {
    return res.status(400).json({ error: 'Please check the submitted information.', details: error.issues });
  }
  if (error.code === 'P2002') return res.status(409).json({ error: 'That record already exists.' });
  if (error.code === 'P2025') return res.status(404).json({ error: 'The requested record was not found.' });
  if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message });
  req.log?.error({ err: error }, 'Request failed');
  return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
}
