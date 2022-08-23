const SentrySwaggerMenu = () => (
  <div className="toc">
    <ul className="list-unstyled">
      <li className="mb-3">
        <a className="sidebar-title active sidebar-link" href="/api/">
          <h6>API Reference</h6>
        </a>
        <ul className="list-unstyled">
          <li>
            <a className="sidebar-link" href="/api/auth/">
              Authentication
            </a>
          </li>
          <li>
            <a className="sidebar-link" href="/api/pagination/">
              Paginating Results
            </a>
          </li>
        </ul>
      </li>
    </ul>
  </div>
);

export default SentrySwaggerMenu;
