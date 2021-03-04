/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';
import {action} from '@storybook/addon-actions';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DropdownButton from 'app/components/dropdownButton';
import DropdownLink from 'app/components/dropdownLink';
import NavigationButtonGroup from 'app/components/navigationButtonGroup';
import {IconDelete} from 'app/icons/iconDelete';

const Item = styled('span')`
  padding: 12px;
`;

const WideButton = styled(Button)`
  width: 200px;
`;

export default {
  title: 'Core/Buttons',
  component: Button,
};

export const _Button = ({icon, onClick, ...args}) => (
  <Button onClick={onClick} icon={icon && <IconDelete />} {...args}>
    Button
  </Button>
);
_Button.args = {
  title: 'title',
  priority: undefined,
  size: undefined,
  borderless: false,
  icon: false,
  busy: false,
  disabled: false,
};
_Button.argTypes = {
  priority: {
    control: {
      type: 'select',
      options: ['default', 'primary', 'danger', 'link', 'success', 'form'],
    },
  },
  size: {
    control: {
      type: 'select',
      options: ['zero', 'xsmall', 'small'],
    },
  },
};

export const Overview = ({busy}) => (
  <div>
    <div className="section">
      <h2>Priorities</h2>
      <Item>
        <Button to="/test" onClick={action('clicked default')}>
          Default Button
        </Button>
      </Item>
      <Item>
        <Button title="Tooltip" priority="primary" onClick={action('click primary')}>
          Primary Button
        </Button>
      </Item>
      <Item>
        <Button priority="success" onClick={action('click success')}>
          Success Button
        </Button>
      </Item>
      <Item>
        <Button priority="danger" onClick={action('click danger')}>
          Danger Button
        </Button>
      </Item>
      <Item>
        <Button priority="link" onClick={action('click link')}>
          Link Button
        </Button>
      </Item>
      <Item>
        <Button to="" disabled onClick={action('click disabled')}>
          Disabled Button
        </Button>
      </Item>
    </div>
    <div className="section">
      <h2>Sizes</h2>
      <Item>
        <Button size="zero" borderless>
          Zero
        </Button>
      </Item>
      <Item>
        <Button size="xsmall">X Small</Button>
      </Item>
      <Item>
        <Button size="small">Small</Button>
      </Item>
      <Item>
        <Button>Default</Button>
      </Item>
    </div>
    <div className="section">
      <h2>Icons</h2>
      <div style={{display: 'flex', alignItems: 'center'}}>
        <Item>
          <Button size="zero" borderless icon={<IconDelete size="xs" />} />
        </Item>
        <Item>
          <Button size="xsmall" icon={<IconDelete size="xs" />}>
            X Small
          </Button>
        </Item>
        <Item>
          <Button size="small" icon={<IconDelete size="xs" />}>
            Small
          </Button>
        </Item>
        <Item>
          <Button icon={<IconDelete />}>Default</Button>
        </Item>
      </div>
    </div>
    <div className="section">
      <h2>Alignment</h2>
      <Item>
        <WideButton align="left">Aligned left</WideButton>
      </Item>
      <Item>
        <WideButton align="right">Aligned right</WideButton>
      </Item>
    </div>
    <div className="section">
      <h2>States (busy/disabled)</h2>
      <div style={{display: 'flex', alignItems: 'center'}}>
        <Item>
          <Button busy={busy} priority="primary" size="xsmall">
            Extra Small
          </Button>
        </Item>
        <Item>
          <Button busy={busy} priority="primary" size="small">
            Small
          </Button>
        </Item>
        <Item>
          <Button busy={busy} priority="primary">
            Normal
          </Button>
        </Item>
        <Item>
          <Button priority="primary" disabled onClick={action('click disabled')}>
            Disabled Button
          </Button>
        </Item>
      </div>
    </div>
  </div>
);
Overview.storyName = 'Overview';
Overview.args = {
  busy: true,
};
Overview.parameters = {
  docs: {
    description: {
      story: 'An overview of all the different buttons and states',
    },
  },
};

export const _DropdownButton = () => (
  <React.Fragment>
    <Item>
      <DropdownButton isOpen={false}>Closed</DropdownButton>
    </Item>
    <Item>
      <DropdownButton isOpen>Open</DropdownButton>
    </Item>
  </React.Fragment>
);
_DropdownButton.storyName = 'DropdownButton';
_DropdownButton.parameters = {
  docs: {
    description: {
      story: 'A button meant to be used with some sort of dropdown',
    },
  },
};

export const _ButtonBar = ({gap}) => (
  <div>
    <div className="section">
      <h3>With a Gap</h3>
      <ButtonBar gap={gap}>
        <Button>First Button</Button>
        <Button>Second Button</Button>
        <Button>Third Button</Button>
      </ButtonBar>
    </div>

    <div className="section">
      <h3>Merged Buttons with "active" button</h3>
      <ButtonBar active="left" merged>
        <Button barId="left">Left Button</Button>
        <Button barId="right">Right Button</Button>
      </ButtonBar>
    </div>

    <div className="section">
      <h3>Multiple Merged Buttons with "active" button</h3>
      <ButtonBar active="2" merged>
        <Button barId="1">First Button</Button>
        <Button barId="2">Second Button</Button>
        <Button barId="3">Third Button</Button>
        <Button barId="4">Fourth Button</Button>
      </ButtonBar>
    </div>

    <div className="section">
      <h3>Works with DropdownLink</h3>
      <StartButtonBar merged>
        <DropdownLink customTitle={<Button>First DropdownLink</Button>} />
        <DropdownLink customTitle={<Button>Second DropdownLink</Button>} />
        <DropdownLink customTitle={<Button>Third DropdownLink</Button>} />
      </StartButtonBar>
      <StartButtonBar merged>
        <Button>First Button</Button>
        <DropdownLink customTitle={<Button>Second DropdownLink</Button>} />
        <Button>Third Button</Button>
      </StartButtonBar>
      <StartButtonBar merged>
        <DropdownLink customTitle={<Button>First DropdownLink</Button>} />
        <Button>Second Button</Button>
        <DropdownLink customTitle={<Button>Third DropdownLink</Button>} />
      </StartButtonBar>
    </div>
  </div>
);

_ButtonBar.storyName = 'ButtonBar';
_ButtonBar.args = {
  /** Button gap */
  gap: 1,
};
_ButtonBar.argTypes = {
  gap: {
    control: {
      type: 'select',
      options: [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4],
    },
  },
};
_ButtonBar.parameters = {
  docs: {
    description: {
      story: 'Buttons in a Bar container',
    },
  },
};

export const _NavigationButtonGroup = () => (
  <NavigationButtonGroup
    location={{}}
    hasNext={false}
    hasPrevious
    urls={['#', '#', '#', '#']}
  />
);
_NavigationButtonGroup.storyName = 'NavigationButtonGroup';
_NavigationButtonGroup.info = 'Navigation Buttons Group';

const StartButtonBar = styled(ButtonBar)`
  justify-content: flex-start;
  margin-bottom: 6px;
`;
