import {useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import CollapsibleSection from 'sentry/components/workflowEngine/ui/collapsibleSection';
import {IconAdd, IconEdit, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';

const FREQUENCY_OPTIONS = [
  {value: '5', label: t('5 minutes')},
  {value: '10', label: t('10 minutes')},
  {value: '30', label: t('30 minutes')},
  {value: '60', label: t('60 minutes')},
  {value: '180', label: t('3 hours')},
  {value: '720', label: t('12 hours')},
  {value: '1440', label: t('24 hours')},
  {value: '10080', label: t('1 week')},
  {value: '43200', label: t('30 days')},
];

const TRIGGER_MATCH_OPTIONS = [
  {value: 'all', label: t('all')},
  {value: 'any', label: t('any')},
];

const FILTER_MATCH_OPTIONS = [
  {value: 'all', label: t('all')},
  {value: 'any', label: t('any')},
  {value: 'none', label: t('none')},
];

export default function AutomationForm() {
  const [ifThenCount, setIfThenCount] = useState(1);
  const addIfThenBlock = () => {
    setIfThenCount(ifThenCount + 1);
  };

  return (
    <Form hideFooter>
      <Flex column gap={space(1.5)} style={{padding: space(2)}}>
        <CollapsibleSection title={t('Connect Monitors')} open>
          {/* TODO: fix margins on SimpleTable */}
          <StyledConnectedMonitorsList monitors={[]} />
          <ButtonWrapper justify="space-between">
            <Button icon={<IconAdd />}>{t('Create New Monitor')}</Button>
            <Button icon={<IconEdit />}>{t('Edit Monitors')}</Button>
          </ButtonWrapper>
        </CollapsibleSection>
        <CollapsibleSection title={t('Automation Builder')} open>
          <StepLead>
            {tct('[when:When] [selector] of the following occur', {
              when: <Badge />,
              selector: (
                <EmbeddedWrapper>
                  <EmbeddedSelectField
                    styles={{
                      control: (provided: any) => ({
                        ...provided,
                        minHeight: '21px',
                        height: '21px',
                      }),
                    }}
                    inline={false}
                    isSearchable={false}
                    isClearable={false}
                    name="whenActionMatch"
                    required
                    flexibleControlStateSize
                    value="any"
                    options={TRIGGER_MATCH_OPTIONS}
                    size="xs"
                  />
                </EmbeddedWrapper>
              ),
            })}
          </StepLead>
          {Array.from({length: ifThenCount}).map((_, i) => (
            <IfThenBlock key={i}>
              <StepLead>
                {tct('[if:If] [selector] of these filters match', {
                  if: <Badge />,
                  selector: (
                    <EmbeddedWrapper>
                      <EmbeddedSelectField
                        styles={{
                          control: (provided: any) => ({
                            ...provided,
                            minHeight: '21px',
                            height: '21px',
                          }),
                        }}
                        inline={false}
                        isSearchable={false}
                        isClearable={false}
                        name="ifActionMatch"
                        required
                        flexibleControlStateSize
                        value="any"
                        options={FILTER_MATCH_OPTIONS}
                        size="xs"
                      />
                    </EmbeddedWrapper>
                  ),
                })}
              </StepLead>
              <div>
                {tct('[then:Then] perform these actions', {
                  then: <Badge />,
                })}
              </div>
            </IfThenBlock>
          ))}
          <span>
            <PurpleTextButton
              borderless
              icon={<IconAdd />}
              size={'xs'}
              onClick={addIfThenBlock}
            >
              {t('If/Then Block')}
            </PurpleTextButton>
          </span>
          <span>
            <Button icon={<IconMail />}>{t('Send Test Notification')}</Button>
          </span>
        </CollapsibleSection>
        <CollapsibleSection
          title={t('Action Interval')}
          description={t('Perform the set actions once per set interval')}
          open
        >
          <EmbeddedSelectField
            name="frequency"
            inline={false}
            clearable={false}
            options={FREQUENCY_OPTIONS}
          />
        </CollapsibleSection>
      </Flex>
    </Form>
  );
}

const StyledConnectedMonitorsList = styled(ConnectedMonitorsList)`
  margin: ${space(2)} 0;
`;

const ButtonWrapper = styled(Flex)`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  margin: -${space(2)};
`;

const PurpleTextButton = styled(Button)`
  color: ${p => p.theme.purple300};
  font-weight: normal;
`;

const StepLead = styled('div')`
  margin-bottom: ${space(0.5)};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const Badge = styled('span')`
  display: inline-block;
  background-color: ${p => p.theme.purple300};
  padding: 0 ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.white};
  text-transform: uppercase;
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.5;
`;

const EmbeddedSelectField = styled(SelectField)`
  padding: 0;
  font-weight: ${p => p.theme.fontWeightNormal};
  text-transform: none;
`;

const EmbeddedWrapper = styled('div')`
  width: 80px;
`;

const IfThenBlock = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};
`;
