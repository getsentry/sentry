import {Fragment} from 'react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
// import Terminal from 'sentry/components/terminal';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {SERVER_SIDE_DOC_LINK} from '../utils';

import {FooterActions, Stepper} from './uniformRateModal';

type Props = ModalRenderProps & {
  organization: Organization;
  project?: Project;
};

const sdkUpdates = [
  {
    projectId: '4291',
    sdkName: 'sentry.javascript.browser',
    sdkVersion: '6.3.1',
    suggestions: [
      {
        enabled: [],
        newSdkVersion: '7.5.0',
        sdkName: 'sentry.javascript.browser',
        sdkUrl: 'https://docs.sentry.io/platforms/javascript',
        type: 'updateSdk',
      },
    ],
  },
  {
    projectId: '5480829',
    sdkName: 'sentry.javascript.browser',
    sdkVersion: '5.3.0',
    suggestions: [
      {
        enabled: [],
        newSdkVersion: '7.5.0',
        sdkName: 'sentry.javascript.browser',
        sdkUrl: 'https://docs.sentry.io/platforms/javascript',
        type: 'updateSdk',
      },
    ],
  },
];

export function RecommendedStepsModal({Header, Body, Footer, closeModal}: Props) {
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
            {sdkUpdates.map(({projectId}) => (
              <div key={projectId} />
            ))}
          </ListItem>
          <ListItem>
            <h5>{t('Increase your SDK Transaction sample rate')}</h5>
            <TextBlock>
              {t(
                'This comes in handy when server-side sampling target the transactions you want to accept, but you need more of those transactions being sent by your client. Here we  already suggest a value based on your quota and throughput.'
              )}
            </TextBlock>
            <div>
              <pre className="language-groovy highlight">
                <code className="language-groovy">
                  Sentry
                  <span className="token punctuation">.</span>
                  <span className="token function">init</span>
                  <span className="token punctuation">(</span>
                  <span className="token punctuation">{'{'}</span>
                  <span className="token literal-property property">traceSampleRate</span>
                  <span className="token operator">:</span>
                  <span className="token boolean">1.0</span>
                  <span className="token punctuation">,</span>
                  <span className="tocken comment">// 100%</span>
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
          <Button href={SERVER_SIDE_DOC_LINK} external>
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
