import 'prism-sentry/index.css';

import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  OutdatedVersion,
  SdkOutdatedVersion,
  SdkProjectBadge,
  UpdatesList,
  UpdateSuggestion,
  UpdateSuggestions,
} from 'sentry/components/sidebar/broadcastSdkUpdates';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project, ProjectSdkUpdates} from 'sentry/types';
import getSdkUpdateSuggestion from 'sentry/utils/getSdkUpdateSuggestion';
import useProjects from 'sentry/utils/useProjects';
import withSdkUpdates from 'sentry/utils/withSdkUpdates';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {SERVER_SIDE_SAMPLING_DOC_LINK} from '../utils';

import {FooterActions, Stepper} from './uniformRateModal';

type Props = ModalRenderProps & {
  organization: Organization;
  project?: Project;
  sdkUpdates?: ProjectSdkUpdates[] | null;
};

// const sdkUpdates = [
//   {
//     project: 'dynamic-sampling',
//     latestSDKVersion: '1.0.3',
//     latestSDKName: 'sentry.javascript.react',
//     isSendingSampleRate: true,
//   },
//   {
//     project: 'android',
//     latestSDKVersion: '1.0.2',
//     latestSDKName: 'sentry.python',
//     isSendingSampleRate: false,
//   },
// ];

function RecommendedStepsModalContainer({
  Header,
  Body,
  Footer,
  closeModal,
  sdkUpdates,
  organization,
}: Props) {
  // const {projects} = useProjects({
  //   slugs: sdkUpdates.map(sdkUpdate => sdkUpdate.project),
  // });

  const {projects} = useProjects();

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Recommended next steps\u2026')}</h4>
      </Header>
      <Body>
        <List symbol="colored-numeric">
          <ListItem>
            <h5>{t('Update the following SDK versions')}</h5>
            <TextBlock>
              {tct(
                "I know what you're thinking, [italic:“[strong:It's already working, why should I?]”]. By updating the following SDK's before activating any server sampling rules, you're avoiding situations when our servers aren't accepting enough transactions ([doubleSamplingLink:double sampling]) or our servers are accepting too many transactions ([exceededQuotaLink:exceeded quota]).",
                {
                  strong: <strong />,
                  italic: <i />,
                  doubleSamplingLink: <ExternalLink href="" />,
                  exceededQuotaLink: <ExternalLink href="" />,
                }
              )}
            </TextBlock>
            {!sdkUpdates && <LoadingIndicator />}
            {sdkUpdates && (
              <SdkUpdates>
                {sdkUpdates.map(sdkUpdate => {
                  const project = projects.find(({id}) => id === sdkUpdate.projectId);

                  if (!project) {
                    return null;
                  }

                  return (
                    <div key={project.id}>
                      <SdkProjectBadge project={project} organization={organization} />
                      <SdkOutdatedVersion>
                        {tct('This project is on [current-version]', {
                          ['current-version']: (
                            <OutdatedVersion>{`${sdkUpdate.sdkName}@v${sdkUpdate.sdkVersion}`}</OutdatedVersion>
                          ),
                        })}
                      </SdkOutdatedVersion>
                      <UpdateSuggestions>
                        <UpdateSuggestion>
                          {sdkUpdate.suggestions.map((suggestion, i) => (
                            <ListItem key={i}>
                              {getSdkUpdateSuggestion({
                                sdk: {
                                  name: sdkUpdate.sdkName,
                                  version: sdkUpdate.sdkVersion,
                                },
                                suggestion,
                                shortStyle: true,
                                capitalized: true,
                              })}
                            </ListItem>
                          ))}
                        </UpdateSuggestion>
                      </UpdateSuggestions>
                    </div>
                  );
                })}
              </SdkUpdates>
            )}
          </ListItem>
          <ListItem>
            <h5>{t('Increase your SDK Transaction sample rate')}</h5>
            <TextBlock>
              {t(
                'This comes in handy when server-side sampling target the transactions you want to accept, but you need more of those transactions being sent by your client. Here we  already suggest a value based on your quota and throughput.'
              )}
            </TextBlock>
            <div>
              <pre className="language-javascript highlight">
                <code className="language-javascript">
                  Sentry
                  <span className="token punctuation">.</span>
                  <span className="token function">init</span>
                  <span className="token punctuation">(</span>
                  <span className="token punctuation">{'{'}</span>
                  <br />
                  <span className="token punctuation">{'  ...'}</span>
                  <br />
                  <span className="token literal-property property">
                    {'  traceSampleRate'}
                  </span>
                  <span className="token operator">:</span>{' '}
                  <span className="token string">1.0</span>
                  <span className="token punctuation">,</span>{' '}
                  <span className="token comment">// 100%</span>
                  <br />
                  <span className="token punctuation">{'}'}</span>
                  <span className="token punctuation">)</span>
                  <span className="token punctuation">;</span>
                </code>
              </pre>
            </div>
          </ListItem>
        </List>
      </Body>
      <Footer>
        <FooterActions>
          <Button href={SERVER_SIDE_SAMPLING_DOC_LINK} external>
            {t('Read Docs')}
          </Button>

          <ButtonBar gap={1}>
            <Stepper>{t('Step 2 of 2')}</Stepper>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button priority="primary">{t('Done')}</Button>
          </ButtonBar>
        </FooterActions>
      </Footer>
    </Fragment>
  );
}

export const RecommendedStepsModal = withSdkUpdates(RecommendedStepsModalContainer);

const SdkUpdates = styled(UpdatesList)`
  margin-top: 0;
  margin-bottom: ${space(3)};
`;
