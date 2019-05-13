import PropTypes from 'prop-types';
import React from 'react';

import NavTabs from 'app/components/navTabs';

const itemsShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  subtext: PropTypes.string.isRequired,
  extra: PropTypes.node,
});

/**
 * Visually fancy choice-card component with an animated hover effect that
 * follows the focused choice. Uses react-pose to handle animations of the
 * background element by passing the computed rect
 */
class SetupChoices extends React.Component {
  static propTypes = {
    choices: PropTypes.arrayOf(itemsShape),
    selectedChoice: PropTypes.string,
    onSelect: PropTypes.func,
  };

  render() {
    const {choices, selectedChoice, onSelect} = this.props;

    return (
      <NavTabs underlined={true}>
        {choices.map(({id, title, icon, subtext, extra}) => (
          <li key={id} className={id === selectedChoice ? 'active' : null}>
            <a
              href="#"
              onClick={e => {
                onSelect(id);
                e.preventDefault();
              }}
            >
              {title}
            </a>
          </li>
        ))}
      </NavTabs>
    );
  }
}

export default SetupChoices;
