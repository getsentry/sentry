import {Fragment, ReactNode, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';

type Props = {
  eventView: EventView;
  isMEPEnabled: boolean;
  onApply: (isMEPEnabled: boolean) => void;
  organization: Organization;
  projects: Project[];
} & ModalRenderProps;

function SamplingModal(props: Props) {
  const {Header, Body, Footer, organization, eventView, isMEPEnabled, projects} = props;

  const project = projects.find(p => `${eventView.project[0]}` === p.id);

  const choices: [string, ReactNode][] = [
    ['true', t('Automatically switch to sampled data when required')],
    ['false', t('Always show sampled data')],
  ];

  const [choice, setChoice] = useState(choices[isMEPEnabled ? 0 : 1][0]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Sampling Settings')}</h4>
      </Header>
      <Body>
        <Instruction>
          {tct(
            "The visualizations shown are based on your data without any filters or sampling. This does not contribute to your quota usage but transaction details are limited. If you'd like to improve accuracy, we recommend adding more transactions to your quota. or modifying your dataset through [projectSettings: Sampling in settings].",
            {
              projectSettings: (
                <Link
                  to={`/settings/${organization.slug}/projects/${project?.slug}/performance/`}
                />
              ),
            }
          )}
        </Instruction>
        <Instruction>
          <RadioGroup
            style={{flex: 1}}
            choices={choices}
            value={choice}
            label=""
            onChange={(id: string) => setChoice(id)}
          />
        </Instruction>
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button priority="default" onClick={() => {}} data-test-id="reset-all">
            {t('Read the docs')}
          </Button>
          <Button
            aria-label={t('Apply')}
            priority="primary"
            onClick={event => {
              event.preventDefault();
              props.closeModal();
              // Use onApply since modal might be outside of the provider due to portal/wormholing.
              props.onApply(choice === 'true');
            }}
            data-test-id="apply-threshold"
          >
            {t('Apply')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

const Instruction = styled('div')`
  margin-bottom: ${space(4)};
`;

export default SamplingModal;

export const modalCss = css`
  width: 100%;
  max-width: 650px;
  margin: 70px auto;
`;
