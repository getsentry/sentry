import NavTabs from 'app/components/navTabs';

import {SetupDescriptor} from '.';

type Props = {
  choices: SetupDescriptor[];
  selectedChoice: string;
  onSelect: (choice: string) => void;
};

const SetupChoices = ({choices, selectedChoice, onSelect}: Props) => (
  <NavTabs underlined>
    {choices.map(({id, title}) => (
      <li key={id} className={id === selectedChoice ? 'active' : undefined}>
        <a
          href="#"
          data-test-id={`onboarding-getting-started-${id}`}
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

export default SetupChoices;
