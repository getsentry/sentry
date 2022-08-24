export interface Props {
  menuItems: {href: string; title: string}[];
}

const SentrySwaggerMenu = ({menuItems}: Props) => (
  <div className="toc">
    <ul className="list-unstyled">
      <li className="mb-3">
        <a className="sidebar-title active sidebar-link" href="/api/">
          <h6>API Reference</h6>
        </a>
        <ul className="list-unstyled">
          {menuItems.map(({title, href}) => (
            <li key={`${title}${href}`}>
              <a className="sidebar-link" href={href}>
                {title}
              </a>
            </li>
          ))}
        </ul>
      </li>
    </ul>
  </div>
);

export default SentrySwaggerMenu;
