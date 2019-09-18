import React from 'react';
import styled, {css} from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import Button from 'app/components/button';
import space from 'app/styles/space';

type Props = {};

export default class TriggersList extends React.Component<Props> {
  render() {
    return (
      <Panel>
        <PanelHeaderGrid>
          <div>{t('Label')}</div>
          <div>{t('Condition')}</div>
          <div>{t('Actions')}</div>
        </PanelHeaderGrid>
        <PanelBody>
          <Grid>
            <Label>SEV-0</Label>
            <Condition>
              <MainCondition>1% increase in Error Rate</MainCondition>
              <SecondaryCondition>
                Auto-resolves when metric falls below 1%
              </SecondaryCondition>
            </Condition>
            <Actions>
              <ul>
                <li>Email members of #team-billing</li>
              </ul>

              <Button type="default" icon="icon-edit" size="small">
                Edit
              </Button>
            </Actions>
          </Grid>
        </PanelBody>
      </Panel>
    );
  }
}

const gridCss = css`
  display: grid;
  grid-template-columns: 1fr 2fr 3fr;
  grid-gap: ${space(1)};
  align-items: center;
`;

const PanelHeaderGrid = styled(PanelHeader)`
  ${gridCss};
`;

const Grid = styled('div')`
  ${gridCss};
  padding: ${space(2)};
`;

const Cell = styled('div')``;

const Label = styled(Cell)`
  font-size: 1.2em;
`;

const Condition = styled(Cell)``;

const MainCondition = styled('div')``;
const SecondaryCondition = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray2};
`;

const Actions = styled(Cell)`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
