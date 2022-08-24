import {useState} from 'react';

export interface MenuItem {
  title: string;
  href?: string;
}

export interface Props {
  menuItems: MenuItem[];
  onMenuItemClick: (itemName: MenuItem) => void;
}

const SentrySwaggerMenu = ({menuItems, onMenuItemClick}: Props) => {
  const [selectedMenuItem, setSelectedMenuItem] = useState<string>(menuItems[0].title);

  const handleMenuClick = item => {
    onMenuItemClick(item);
    setSelectedMenuItem(item.title);
  };

  return (
    <div className="toc">
      <ul className="list-unstyled">
        <li className="mb-3">
          <ul className="list-unstyled">
            {menuItems.map(item => (
              <li key={`${item.title}`}>
                <div
                  style={{cursor: 'pointer'}}
                  className={`sidebar-link ${
                    item.title === selectedMenuItem ? 'selected' : ''
                  }`}
                  onClick={() => handleMenuClick(item)}
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
};

export default SentrySwaggerMenu;
