import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {NumberField} from 'sentry/components/forms';
import {PanelTable} from 'sentry/components/panels';
import Radio from 'sentry/components/radio';
import {IconRefresh} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {SERVER_SIDE_DOC_LINK} from '../utils';

enum Strategy {
  CURRENT = 'current',
  RECOMMENDED = 'recommended',
}

type Props = ModalRenderProps & {
  organization: Organization;
  project?: Project;
};

function UniformRateModal({Header, Body, Footer, closeModal}: Props) {
  // TODO(sampling): fetch from API
  const affectedProjects = ['ProjectA', 'ProjectB', 'ProjectC'];

  // TODO(sampling): calculate dynamically
  const currentClientSampling = 10;
  const currentServerSampling = undefined;
  const recommendedClientSampling = 100;
  const recommendedServerSampling = 10;

  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>(Strategy.CURRENT);
  const [client, setClient] = useState(recommendedClientSampling);
  const [server, setServer] = useState(recommendedServerSampling);

  const isEdited =
    client !== recommendedClientSampling || server !== recommendedServerSampling;

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Set a uniform sample rate for Transactions')}</h4>
      </Header>
      <Body>
        <TextBlock>
          {tct(
            'Similarly to how you would configure a [transactionSampleRate: Transaction Sample Rate] from within your client’s [sentryInit: Sentry.init()], we ask you to [uniformRate: set a uniform sample rate] which provides an even cross-section of transactions from [allProjects: all projects].',
            {
              transactionSampleRate: <strong />,
              sentryInit: <strong />,
              uniformRate: <strong />,
              allProjects: <strong />,
            }
          )}
        </TextBlock>

        <StyledPanelTable
          headers={[
            t('Sampling Values'),
            <RightAligned key="client">{t('Client')}</RightAligned>,
            <RightAligned key="server">{t('Server')}</RightAligned>,
            '',
          ]}
        >
          <Fragment>
            <Label htmlFor="sampling-current">
              <Radio
                id="sampling-current"
                checked={selectedStrategy === Strategy.CURRENT}
                onChange={() => {
                  setSelectedStrategy(Strategy.CURRENT);
                }}
              />
              {t('Current')}
            </Label>
            <RightAligned>{formatPercentage(currentClientSampling / 100)}</RightAligned>
            <RightAligned>
              {defined(currentServerSampling)
                ? formatPercentage(currentServerSampling / 100)
                : 'N/A'}
            </RightAligned>
            <div />
          </Fragment>
          <Fragment>
            <Label htmlFor="sampling-recommended">
              <Radio
                id="sampling-recommended"
                checked={selectedStrategy === Strategy.RECOMMENDED}
                onChange={() => {
                  setSelectedStrategy(Strategy.RECOMMENDED);
                }}
              />
              {isEdited ? t('New') : t('Recommended')}
            </Label>
            <RightAligned>
              <StyledNumberField
                name="recommended-client-sampling"
                placeholder="%"
                value={client}
                onChange={value => {
                  setClient(value);
                }}
                onFocus={() => setSelectedStrategy(Strategy.RECOMMENDED)}
                stacked
                flexibleControlStateSize
                inline={false}
              />
            </RightAligned>
            <RightAligned>
              <StyledNumberField
                name="recommended-server-sampling"
                placeholder="%"
                value={server}
                onChange={value => {
                  setServer(value);
                }}
                onFocus={() => setSelectedStrategy(Strategy.RECOMMENDED)}
                stacked
                flexibleControlStateSize
                inline={false}
              />
            </RightAligned>
            <ResetButton>
              {isEdited && (
                <Button
                  icon={<IconRefresh size="sm" />}
                  aria-label={t('Reset to recommended values')}
                  onClick={() => {
                    setClient(recommendedClientSampling);
                    setServer(recommendedServerSampling);
                  }}
                  borderless
                  size="zero"
                />
              )}
            </ResetButton>
          </Fragment>
        </StyledPanelTable>

        <Alert>
          {tct(
            'To ensures that any active server-side sampling rules won’t sharply decrease the amount of accepted transactions, we recommend you update the Sentry SDK versions for [affectedProjects]. More details in [step2: Step 2].',
            {
              step2: <strong />,
              affectedProjects: <strong>{affectedProjects.join(', ')}</strong>,
            }
          )}
        </Alert>
      </Body>
      <Footer>
        <FooterActions>
          <Button href={SERVER_SIDE_DOC_LINK} external>
            {t('Read Docs')}
          </Button>

          <ButtonBar gap={1}>
            <Stepper>{t('Step 1 of 2')}</Stepper>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button priority="primary">{t('Next')}</Button>
          </ButtonBar>
        </FooterActions>
      </Footer>
    </Fragment>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 100px 100px 35px;
`;

const RightAligned = styled('div')`
  text-align: right;
`;

const ResetButton = styled('div')`
  padding-left: 0;
  display: inline-flex;
`;

const Label = styled('label')`
  font-weight: 400;
  display: inline-flex;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: 0;
`;

const StyledNumberField = styled(NumberField)`
  width: 100%;
`;

const FooterActions = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  gap: ${space(1)};
`;

const Stepper = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;

export {UniformRateModal};
