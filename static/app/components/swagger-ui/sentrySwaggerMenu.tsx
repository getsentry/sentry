export interface MenuItem {
  title: string;
  href?: string;
}

export interface Props {
  menuItems: MenuItem[];
  onMenuItemClick: (itemName: MenuItem) => void;
}

const SentrySwaggerMenu = ({menuItems, onMenuItemClick}: Props) => (
  <div className="toc">
    <ul className="list-unstyled">
      <li className="mb-3">
        <ul className="list-unstyled">
          {menuItems.map(item => (
            <li key={`${item.title}`}>
              <div
                style={{cursor: 'pointer'}}
                className="sidebar-link"
                onClick={() => onMenuItemClick(item)}
              >
                {item.title}
              </div>
            </li>
          ))}
        </ul>
      </li>
    </ul>
  </div>
);

export default SentrySwaggerMenu;
