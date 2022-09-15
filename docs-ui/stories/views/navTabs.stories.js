import NavTabs from 'sentry/components/navTabs';

export default {
  title: 'Views/Nav Tabs',
  component: NavTabs,
};

export const Default = () => {
  return (
    <NavTabs>
      <li className="active">
        <a href="#">link one</a>
      </li>
      <li>
        <a href="#">link two</a>
      </li>
    </NavTabs>
  );
};

Default.storyName = 'Default';

export const Underlined = () => {
  return (
    <NavTabs underlined>
      <li className="active">
        <a href="#">link one</a>
      </li>
      <li>
        <a href="#">link two</a>
      </li>
    </NavTabs>
  );
};

Underlined.storyName = 'Underlined';
Underlined.parameters = {
  docs: {
    description: {
      story: 'NavTabs with bottom border applied',
    },
  },
};
