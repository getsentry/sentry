import React from 'react';
import styled from '@emotion/styled';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';
import {boolean, number} from '@storybook/addon-knobs';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DropdownButton from 'app/components/dropdownButton';
import {IconDelete} from 'app/icons/iconDelete';

const Item = styled('span')`
  padding: 12px;
`;

const Section = styled('div')`
  margin-bottom: 32px;
`;

const WideButton = styled(Button)`
  width: 200px;
`;

// eslint-disable-next-line
storiesOf('UI|Buttons', module)
  .add(
    'overview',
    withInfo({
      text: 'An overview of all the different buttons and states',
      propTablesExclude: [Item, Section],
    })(() => (
      <div>
        <Section>
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
        </Section>
        <Section>
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
        </Section>
        <Section>
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
        </Section>
        <Section>
          <h2>Alignment</h2>
          <Item>
            <WideButton align="left">Aligned left</WideButton>
          </Item>
          <Item>
            <WideButton align="right">Aligned right</WideButton>
          </Item>
        </Section>
        <Section>
          <h2>States (busy/disabled)</h2>
          <div style={{display: 'flex', alignItems: 'center'}}>
            <Item>
              <Button
                busy={boolean('Extra Small Busy', true)}
                priority="primary"
                size="xsmall"
              >
                Extra Small
              </Button>
            </Item>
            <Item>
              <Button busy={boolean('Small Busy', true)} priority="primary" size="small">
                Small
              </Button>
            </Item>
            <Item>
              <Button busy={boolean('Normal Busy', true)} priority="primary">
                Normal
              </Button>
            </Item>
            <Item>
              <Button priority="primary" disabled onClick={action('click disabled')}>
                Disabled Button
              </Button>
            </Item>
          </div>
        </Section>
      </div>
    ))
  )
  .add(
    'DropdownButton',
    withInfo('A button meant to be used with some sort of dropdown')(() => (
      <React.Fragment>
        <Item>
          <DropdownButton isOpen={false}>Closed</DropdownButton>
        </Item>
        <Item>
          <DropdownButton isOpen>Open</DropdownButton>
        </Item>
      </React.Fragment>
    ))
  )
  .add(
    'ButtonBar',
    withInfo('Buttons in a Bar container')(() => (
      <div>
        <Section>
          <h3>With a Gap</h3>
          <ButtonBar gap={number('button gap', 1)}>
            <Button>First Button</Button>
            <Button>Second Button</Button>
            <Button>Third Button</Button>
          </ButtonBar>
        </Section>

        <Section>
          <h3>Merged Buttons with "active" button</h3>
          <ButtonBar active="left" merged>
            <Button barId="left">Left Button</Button>
            <Button barId="right">Right Button</Button>
          </ButtonBar>
        </Section>

        <Section>
          <h3>Multiple Merged Buttons with "active" button</h3>
          <ButtonBar active="2" merged>
            <Button barId="1">First Button</Button>
            <Button barId="2">Second Button</Button>
            <Button barId="3">Third Button</Button>
            <Button barId="4">Fourth Button</Button>
          </ButtonBar>
        </Section>
      </div>
    ))
  );
