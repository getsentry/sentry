import {Component} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Radio from 'sentry/components/radio';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OrgRole} from 'sentry/types';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const Label = styled('label')`
  display: flex;
  flex: 1;
  align-items: center;
  margin-bottom: 0;
`;

type Props = {
  disabled: boolean;
  enforceAllowed: boolean;
  enforceRetired: boolean;
  helpText: string | undefined;
  roleList: OrgRole[];
  roleSelected: string;
  setSelected: (id: string) => void;
};

class OrganizationRoleSelect extends Component<Props> {
  render() {
    const {
      disabled,
      enforceRetired,
      enforceAllowed,
      roleList,
      roleSelected,
      setSelected,
      helpText,
    } = this.props;

    return (
      <Panel>
        <StyledPanelHeader>
          <div>{t('Organization Role')}</div>
          {disabled && <QuestionTooltip size="sm" title={helpText} />}
        </StyledPanelHeader>

        <PanelBody>
          {roleList.map(role => {
            const {desc, name, id, allowed, isRetired: roleRetired} = role;

            const isRetired = enforceRetired && roleRetired;
            const isDisabled = disabled || isRetired || (enforceAllowed && !allowed);

            return (
              <PanelItem
                key={id}
                onClick={() => !isDisabled && setSelected(id)}
                css={!isDisabled ? {} : {color: 'grey', cursor: 'default'}}
              >
                <Label>
                  <Radio id={id} value={name} checked={id === roleSelected} readOnly />
                  <div style={{flex: 1, padding: '0 16px'}}>
                    {name}
                    <TextBlock noMargin>
                      <div className="help-block">{desc}</div>
                    </TextBlock>
                  </div>
                </Label>
              </PanelItem>
            );
          })}
        </PanelBody>
      </Panel>
    );
  }
}

const StyledPanelHeader = styled(PanelHeader)`
  display: flex;
  gap: ${space(0.5)};
  justify-content: left;
`;

export default OrganizationRoleSelect;
