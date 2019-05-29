import PropTypes from 'prop-types';
import React from 'react';

import NavTabs from 'app/components/navTabs';

const itemsShape = PropTypes.shape({
  title: PropTypes.string.isRequired,
});

const SetupChoices = ({choices, selectedChoice, onSelect}) => (
  <NavTabs underlined={true}>
    {choices.map(({id, title}) => (
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

SetupChoices.propTypes = {
  choices: PropTypes.arrayOf(itemsShape),
  selectedChoice: PropTypes.string,
  onSelect: PropTypes.func,
};

export default SetupChoices;
