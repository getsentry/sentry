import React from 'react';
import styled from '@emotion/styled';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';
import {boolean} from '@storybook/addon-knobs';

import Button from 'app/components/button';
import DropdownButton from 'app/components/dropdownButton';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

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
            <Button to="" disabled onClick={action('click disabled')}>
              Disabled Button
            </Button>
          </Item>
        </Section>

        <Section>
          <h2>Sizes</h2>
          <Item>
            <Button size="micro">Micro</Button>
          </Item>

          <Item>
            <Button size="zero">Zero</Button>
          </Item>

          <Item>
            <Button size="xxsmall">Extra Extra Small</Button>
          </Item>

          <Item>
            <Button size="xsmall">Extra Small</Button>
          </Item>

          <Item>
            <Button size="small">Small</Button>
          </Item>

          <Item>
            <Button>Normal</Button>
          </Item>

          <Item>
            <Button size="large">Large</Button>
          </Item>
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
          <h2>Icons</h2>
          <div style={{display: 'flex', alignItems: 'center'}}>
            <Item>
              <Button>
                <InlineSvg
                  src="icon-github"
                  size="14"
                  style={{marginRight: space(0.5)}}
                />
                Not-icon-props Button
              </Button>
            </Item>
            <Item>
              <Button icon="icon-github">Icon Button</Button>
            </Item>
            <Item>
              <Button size="small" icon="icon-github">
                View on GitHub
              </Button>
            </Item>
            <Item>
              <Button size="micro" icon="icon-trash" />
            </Item>
            <Item>
              <Button size="zero" icon="icon-trash" />
            </Item>
            <Item>
              <Button size="xxsmall" icon="icon-trash" />
            </Item>
            <Item>
              <Button size="xsmall" icon="icon-trash" />
            </Item>
            <Item>
              <Button size="small" icon="icon-trash" />
            </Item>
            <Item>
              <Button icon="icon-trash" />
            </Item>
            <Item>
              <Button size="large" icon="icon-trash" />
            </Item>
          </div>
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
              <Button busy={boolean('Large Busy', true)} priority="primary" size="large">
                Large
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
  );
