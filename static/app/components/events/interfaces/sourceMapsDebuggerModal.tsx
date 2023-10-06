import {Fragment, PropsWithChildren, ReactNode, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import FeatureBadge from 'sentry/components/featureBadge';
import {FeedbackModal} from 'sentry/components/featureFeedback/feedbackModal';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import ProgressRing from 'sentry/components/progressRing';
import {TabPanels, Tabs} from 'sentry/components/tabs';
import {TabList} from 'sentry/components/tabs/tabList';
import {
  IconCheckmark,
  IconCircle,
  IconMegaphone,
  IconOpen,
  IconQuestion,
  IconRefresh,
  IconWarning,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {SourceMapWizardBlueThunderAnalyticsParams} from 'sentry/utils/analytics/stackTraceAnalyticsEvents';

export interface FrameSourceMapDebuggerData {
  debugIdProgress: number;
  debugIdProgressPercent: number;
  dist: string | null;
  eventHasDebugIds: boolean;
  frameIsResolved: boolean;
  matchingSourceFileNames: string[];
  matchingSourceMapName: string | null;
  release: string | null;
  releaseHasSomeArtifact: boolean;
  releaseProgress: number;
  releaseProgressPercent: number;
  releaseSourceMapReference: string | null;
  scrapingProgress: number;
  scrapingProgressPercent: number;
  sdkDebugIdSupport: 'full' | 'needs-upgrade' | 'not-supported' | 'unofficial-sdk';
  sdkVersion: string | null;
  sourceFileReleaseNameFetchingResult: 'found' | 'wrong-dist' | 'unsuccessful';
  sourceFileScrapingStatus:
    | {status: 'found'}
    | {error: string; status: 'error'}
    | {status: 'none'};
  sourceMapReleaseNameFetchingResult: 'found' | 'wrong-dist' | 'unsuccessful';
  sourceMapScrapingStatus:
    | {status: 'found'}
    | {error: string; status: 'error'}
    | {status: 'none'};
  stackFrameDebugId: string | null;
  stackFramePath: string | null;
  uploadedSomeArtifactWithDebugId: boolean;
  uploadedSourceFileWithCorrectDebugId: boolean;
  uploadedSourceMapWithCorrectDebugId: boolean;
}

interface SourceMapsDebuggerModalProps extends ModalRenderProps {
  analyticsParams: SourceMapWizardBlueThunderAnalyticsParams & {
    organization: Organization | null;
  };
  sourceResolutionResults: FrameSourceMapDebuggerData;
}

export function SourceMapsDebuggerModal({
  Body,
  Header,
  Footer,
  sourceResolutionResults,
  analyticsParams,
}: SourceMapsDebuggerModalProps) {
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState<'debug-ids' | 'release' | 'fetching'>(() => {
    const possibleTabs = [
      {tab: 'debug-ids', progress: sourceResolutionResults.debugIdProgressPercent},
      {tab: 'release', progress: sourceResolutionResults.releaseProgressPercent},
      {tab: 'fetching', progress: sourceResolutionResults.scrapingProgressPercent},
    ] as const;

    // Get the tab with the most progress
    return possibleTabs.reduce(
      (prev, curr) => (curr.progress > prev.progress ? curr : prev),
      possibleTabs[sourceResolutionResults.sdkDebugIdSupport === 'not-supported' ? 1 : 0]
    ).tab;
  });

  return (
    <Fragment>
      <Header closeButton>
        <ModalHeadingContainer>
          <h4>{t('Make Your Stack Traces Readable')}</h4>
          <FeatureBadge type="beta" tooltipProps={{position: 'right'}} />
        </ModalHeadingContainer>
      </Header>
      <Body>
        <p>
          {t(
            "It looks like the original source code for this stack frame couldn't be determined when this error was captured. To get the original code for this stack frame, Sentry needs source maps to be configured."
          )}
        </p>
        <WizardInstructionParagraph>
          {t(
            'The easiest way to get started with source maps is by running the Sentry Source Map Wizard in the terminal inside your project:'
          )}
        </WizardInstructionParagraph>
        <InstructionCodeSnippet
          language="bash"
          dark
          onCopy={() => {
            trackAnalytics(
              'source_map_debug_blue_thunder.source_map_wizard_command_copied',
              analyticsParams
            );
          }}
          onSelectAndCopy={() => {
            trackAnalytics(
              'source_map_debug_blue_thunder.source_map_wizard_command_copied',
              analyticsParams
            );
          }}
        >
          {'npx @sentry/wizard@latest -i sourcemaps'}
        </InstructionCodeSnippet>
        <p>
          {t(
            'There are multiple ways to configure source maps. The checklists below will help you set them up correctly. Choose one of the following processes:'
          )}
        </p>
        <Tabs<'debug-ids' | 'release' | 'fetching'>
          value={activeTab}
          onChange={tab => {
            setActiveTab(tab);
          }}
        >
          <TabList>
            <TabList.Item
              key="debug-ids"
              textValue={`${t('Debug IDs')} (${
                sourceResolutionResults.debugIdProgress
              }/4)`}
            >
              <StyledProgressRing
                progressColor={
                  activeTab === 'debug-ids' ? theme.purple300 : theme.gray300
                }
                backgroundColor={theme.gray200}
                value={sourceResolutionResults.debugIdProgressPercent * 100}
                size={16}
                barWidth={4}
              />
              {`${t('Debug IDs')}${
                sourceResolutionResults.sdkDebugIdSupport !== 'not-supported'
                  ? ' ' + t('(recommended)')
                  : ''
              }`}
            </TabList.Item>
            <TabList.Item
              key="release"
              textValue={`${t('Releases')} (${
                sourceResolutionResults.releaseProgress
              }/4)`}
            >
              <StyledProgressRing
                progressColor={activeTab === 'release' ? theme.purple300 : theme.gray300}
                backgroundColor={theme.gray200}
                value={sourceResolutionResults.releaseProgressPercent * 100}
                size={16}
                barWidth={4}
              />
              {t('Releases')}
            </TabList.Item>
            <TabList.Item
              key="fetching"
              // TODO: Remove "coming soon" when we add data crawling from symbolicator
              textValue={`${t('Hosting Publicly')} (${t('coming soon')}) (${
                sourceResolutionResults.scrapingProgress
              }/4)`}
              // TODO: enable when we add crawling data from symbolicator
              disabled
              hidden
            >
              <StyledProgressRing
                progressColor={activeTab === 'fetching' ? theme.purple300 : theme.gray300}
                backgroundColor={theme.gray200}
                value={sourceResolutionResults.scrapingProgressPercent * 100}
                size={16}
                barWidth={4}
              />
              {/* TODO: Remove "coming soon" when we add data crawling from symbolicator */}
              {`${t('Hosting Publicly')} (${t('coming soon')})`}
            </TabList.Item>
          </TabList>
          <StyledTabPanels>
            <TabPanels.Item key="debug-ids">
              <p>
                {tct(
                  '[link:Debug IDs] are a way of matching your source files to source maps. Follow all of the steps below to get a readable stack trace:',
                  {
                    link: (
                      <ExternalLinkWithIcon href="https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/artifact-bundles/" />
                    ),
                  }
                )}
              </p>
              <CheckList>
                <InstalledSdkChecklistItem
                  setActiveTab={setActiveTab}
                  sourceResolutionResults={sourceResolutionResults}
                />
                <HasDebugIdChecklistItem
                  shouldValidate={
                    sourceResolutionResults.sdkDebugIdSupport === 'full' ||
                    sourceResolutionResults.sdkDebugIdSupport === 'unofficial-sdk' ||
                    sourceResolutionResults.eventHasDebugIds
                  }
                  sourceResolutionResults={sourceResolutionResults}
                />
                <UploadedSourceFileWithCorrectDebugIdChecklistItem
                  shouldValidate={sourceResolutionResults.stackFrameDebugId !== null}
                  sourceResolutionResults={sourceResolutionResults}
                />
                <UploadedSourceMapWithCorrectDebugIdChecklistItem
                  shouldValidate={
                    sourceResolutionResults.uploadedSourceFileWithCorrectDebugId
                  }
                  sourceResolutionResults={sourceResolutionResults}
                />
              </CheckList>
              {sourceResolutionResults.debugIdProgressPercent === 1 ? (
                <ChecklistDoneNote />
              ) : (
                <VerifyAgainNote />
              )}
            </TabPanels.Item>
            <TabPanels.Item key="release">
              <p>
                {tct(
                  'You can match your stack trace to your source code based on [link:Releases] and artifact names. Follow all of the steps below to get a readable stack trace:',
                  {
                    link: (
                      <ExternalLinkWithIcon href="https://docs.sentry.io/product/releases/" />
                    ),
                  }
                )}
              </p>
              <CheckList>
                <EventHasReleaseNameChecklistItem
                  sourceResolutionResults={sourceResolutionResults}
                />
                <ReleaseHasUploadedArtifactsChecklistItem
                  shouldValidate={sourceResolutionResults.release !== null}
                  sourceResolutionResults={sourceResolutionResults}
                />
                <ReleaseSourceFileMatchingChecklistItem
                  shouldValidate={sourceResolutionResults.releaseHasSomeArtifact}
                  sourceResolutionResults={sourceResolutionResults}
                />
                <ReleaseSourceMapMatchingChecklistItem
                  shouldValidate={
                    sourceResolutionResults.sourceFileReleaseNameFetchingResult ===
                    'found'
                  }
                  sourceResolutionResults={sourceResolutionResults}
                />
              </CheckList>
              {sourceResolutionResults.releaseProgressPercent === 1 ? (
                <ChecklistDoneNote />
              ) : (
                <VerifyAgainNote />
              )}
            </TabPanels.Item>
            <TabPanels.Item key="fetching">
              <p>
                {tct(
                  'Sentry will fetch your source files and source maps if you [link:host them publicly].',
                  {
                    link: (
                      <ExternalLinkWithIcon href="https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/hosting-publicly/" />
                    ),
                  }
                )}
              </p>
              <CheckList>
                <ScrapingSourceFileAvailableChecklistItem
                  sourceResolutionResults={sourceResolutionResults}
                />
                <ScrapingSourceMapAvailableChecklistItem
                  shouldValidate={
                    sourceResolutionResults.sourceFileScrapingStatus.status === 'found'
                  }
                  sourceResolutionResults={sourceResolutionResults}
                />
              </CheckList>
              {sourceResolutionResults.scrapingProgressPercent === 1 ? (
                <ChecklistDoneNote />
              ) : (
                <VerifyAgainNote />
              )}
            </TabPanels.Item>
          </StyledTabPanels>
        </Tabs>
      </Body>
      <Footer>
        <Link
          to=""
          onClick={e => {
            e.stopPropagation();
            openModal(modalProps => (
              <FeedbackModal
                featureName="sourcemaps-debugger"
                feedbackTypes={[t('This was helpful'), t('This was not helpful')]}
                {...modalProps}
              />
            ));
          }}
        >
          {t('Was this helpful? Give us feedback!')} <IconMegaphone size="xs" />
        </Link>
      </Footer>
    </Fragment>
  );
}

function CheckListItem({children, title, status}: PropsWithChildren<CheckListItemProps>) {
  return (
    <ListItemContainer>
      <CheckMarkContainer>
        {
          {
            none: <IconCircle size="md" color="gray200" />,
            checked: <IconCheckmark size="md" color="green300" isCircled />,
            alert: <IconWarning size="md" color="yellow300" />,
            question: <IconQuestion size="md" color="gray300" />,
          }[status]
        }
        <Line className="source-map-debugger-modal-checklist-line" />
      </CheckMarkContainer>
      <ListItemContentContainer>
        <ListItemTitleWrapper>
          <ListItemTitle status={status}>{title}</ListItemTitle>
        </ListItemTitleWrapper>
        {children}
      </ListItemContentContainer>
    </ListItemContainer>
  );
}

function InstalledSdkChecklistItem({
  sourceResolutionResults,
  setActiveTab,
}: {
  setActiveTab: React.Dispatch<
    React.SetStateAction<'release' | 'debug-ids' | 'fetching'>
  >;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const successMessage = t('Installed SDK supports Debug IDs');
  const errorMessage = t('Installed SDK does not support Debug IDs');
  const maybeErrorMessage = t("Installed SDK potentially doesn't support Debug IDs");

  if (
    sourceResolutionResults.eventHasDebugIds ||
    sourceResolutionResults.sdkDebugIdSupport === 'full'
  ) {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.sdkDebugIdSupport === 'needs-upgrade') {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction type="muted">
          <h6>{t('Outdated SDK')}</h6>
          <p>
            {sourceResolutionResults.sdkVersion
              ? tct(
                  'You are using version [currentVersion] of the Sentry SDK which does not support debug IDs. You should upgrade to at lease version [targetVersion].',
                  {
                    currentVersion: (
                      <MonoBlock>{sourceResolutionResults.sdkVersion}</MonoBlock>
                    ),
                    targetVersion: <MonoBlock>7.56.0</MonoBlock>,
                  }
                )
              : tct(
                  'You are using an outdated version of the Sentry SDK which does not support debug IDs. You should upgrade to at least version [targetVersion]',
                  {
                    targetVersion: <MonoBlock>7.56.0</MonoBlock>,
                  }
                )}
          </p>
          <p>
            {tct(
              'If upgrading the SDK is not an option for you, you can use the [link:Release] process instead.',
              {
                link: <Link to="" onClick={() => setActiveTab('release')} />,
              }
            )}
          </p>
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.sdkDebugIdSupport === 'not-supported') {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction type="muted">
          <h6>{t("SDK Doesn't Support Debug IDs")}</h6>
          <p>
            {tct(
              'The SDK you are using does not support debug IDs yet. We recommend using the [link:Release] process instead.',
              {
                link: <Link to="" onClick={() => setActiveTab('release')} />,
              }
            )}
          </p>
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="question" title={maybeErrorMessage}>
      <CheckListInstruction type="muted">
        <h6>{t('Unofficial SDK')}</h6>
        <p>
          {tct(
            "You are using an unofficial Sentry SDK. Please check whether this SDK already supports Debug IDs. It's possible that this SDK supports debug IDs but you may be better off using the [link:Release Name] method of uploading source maps.",
            {
              link: <Link to="" onClick={() => setActiveTab('release')} />,
            }
          )}
        </p>
        <p>
          {t(
            'If this SDK depends on an official Sentry SDK, the earliest version that supports Debug IDs is version 7.56.0'
          )}
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function HasDebugIdChecklistItem({
  sourceResolutionResults,
  shouldValidate,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const successMessage = t('Stack frame has Debug IDs');
  const errorMessage = t("Stack frame doesn't have Debug IDs");

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.stackFrameDebugId !== null) {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.eventHasDebugIds) {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction type="muted">
          <h6>{t('Source Is Missing Injection')}</h6>
          <p>
            {tct(
              'The event already has debug IDs for some stack frames but not for this one. Please configure the tool you are using to upload source maps to inject debug IDs into [bold:all] of your build artifacts.',
              {bold: <b />}
            )}
          </p>
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.uploadedSomeArtifactWithDebugId) {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction type="muted">
          <h6>Uploaded Files Not Deployed</h6>
          <p>
            {t(
              "It seems you already uploaded artifacts with Debug IDs, however, this event doesn't contain any Debug IDs yet. Make sure the files you deployed are exactly the files you uploaded to Sentry. For Sentry to be able to show your original source code, it is required that you deploy the exact same files that you uploaded to Sentry."
            )}
          </p>
          <p>
            {t(
              'If you are using a bundler plugin, you need to use the plugin when you build your production app. It is not possible to build your app once with the plugin, just to upload, and then once without. The plugin needs to be active for every build!'
            )}
          </p>
          <p>
            {tct(
              'If you are using Sentry CLI, make sure to deploy the files you ran [injectCommand] on!',
              {
                injectCommand: <MonoBlock>sentry-cli sourcemaps inject</MonoBlock>,
              }
            )}
          </p>
          <p>
            {tct(
              'Read the [link:Sentry Source Maps Documentation] to learn how to inject Debug IDs into your build artifacts and how to upload them to Sentry.',
              {
                link: (
                  <ExternalLinkWithIcon href="https://docs.sentry.io/platforms/javascript/sourcemaps/" />
                ),
              }
            )}
          </p>
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction type="muted">
        <h6>{t('No Debug ID Tooling Used')}</h6>
        <p>
          {tct(
            "This event doesn't contain any Debug IDs. Read the [link:Sentry Source Maps Documentation] to learn how to inject Debug IDs into your build artifacts and how to upload them to Sentry.",
            {
              link: (
                <ExternalLinkWithIcon href="https://docs.sentry.io/platforms/javascript/sourcemaps/" />
              ),
            }
          )}
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function UploadedSourceFileWithCorrectDebugIdChecklistItem({
  sourceResolutionResults,
  shouldValidate,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const successMessage = t('Source file with a matching Debug ID was uploaded');
  const errorMessage = t('Missing source file with a matching Debug ID');

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.uploadedSourceFileWithCorrectDebugId) {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.uploadedSomeArtifactWithDebugId) {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction type="muted">
          <h6>{t('No Soure File With Matching Debug ID')}</h6>
          <p>
            {tct(
              "You already uploaded artifacts with Debug IDs but none of the uploaded source files had a Debug ID matching this stack frame's Debug ID: [debugId]",
              {
                debugId: (
                  <MonoBlock>{sourceResolutionResults.stackFrameDebugId}</MonoBlock>
                ),
              }
            )}
          </p>
          <p>
            {t(
              'Make sure to inject Debug IDs into all of your source files and to upload all of them to Sentry.'
            )}
          </p>
          {/* TODO: Link to Uploaded Artifacts */}
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction type="muted">
        <h6>{t('No Artifacts With Debug IDs Uploaded')}</h6>
        <p>
          {tct(
            "You didn't upload any artifacts with debug IDs yet. Read the [link:Sentry Source Maps Documentation] to learn how to inject Debug IDs into your build artifacts and how to upload them to Sentry.",
            {
              link: (
                <ExternalLinkWithIcon href="https://docs.sentry.io/platforms/javascript/sourcemaps/" />
              ),
            }
          )}
        </p>
        {/* TODO: Link to Uploaded Artifacts */}
      </CheckListInstruction>
    </CheckListItem>
  );
}

function UploadedSourceMapWithCorrectDebugIdChecklistItem({
  sourceResolutionResults,
  shouldValidate,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const successMessage = t('Uploaded source map with a matching Debug ID');
  const errorMessage = t('Missing source map with a matching Debug ID');

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.uploadedSourceMapWithCorrectDebugId) {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.uploadedSomeArtifactWithDebugId) {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction type="muted">
          <h6>{t('No Soure Map With Matching Debug ID')}</h6>
          <p>
            {tct(
              "You already uploaded artifacts with Debug IDs but none of the uploaded source maps had a Debug ID matching this stack frame's Debug ID: [debugId]",
              {
                debugId: (
                  <MonoBlock>{sourceResolutionResults.stackFrameDebugId}</MonoBlock>
                ),
              }
            )}
          </p>
          <p>
            {t(
              'Make sure to inject Debug IDs into all of your source files and to upload all of them to Sentry.'
            )}
          </p>
          {/* TODO: Link to Uploaded Artifacts */}
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction type="muted">
        <h6>{t('No Artifacts Uploaded')}</h6>
        <p>
          {tct(
            "You didn't upload any artifacts with debug IDs yet. Read the [link:Sentry Source Maps Documentation] to learn how to inject Debug IDs into your build artifacts and how to upload them to Sentry.",
            {
              link: (
                <ExternalLinkWithIcon href="https://docs.sentry.io/platforms/javascript/sourcemaps/" />
              ),
            }
          )}
        </p>
        {/* TODO: Link to Uploaded Artifacts */}
      </CheckListInstruction>
      <SourceMapStepNotRequiredNote />
    </CheckListItem>
  );
}

function EventHasReleaseNameChecklistItem({
  sourceResolutionResults,
}: {
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const successMessage = t('Event has release value');
  const errorMessage = t("Event doesn't have a release value");

  if (sourceResolutionResults.release !== null) {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction type="muted">
        <h6>{t('No Release Value')}</h6>
        <p>
          {tct(
            'The captured event does not have a [release] value. Configure a [release] value in the SDK:',
            {release: <MonoBlock>release</MonoBlock>}
          )}
        </p>
        <InstructionCodeSnippet language="javascript" dark hideCopyButton>
          {`Sentry.init({
  release: 'your-release-name'
})`}
        </InstructionCodeSnippet>
        <p>
          {tct(
            'Alternatively, you can configure one of our build tools to automatically inject a release value into your code: [link:Sentry Bundler Support]',
            {
              link: (
                <ExternalLinkWithIcon href="https://docs.sentry.io/platforms/javascript/sourcemaps/#sentry-bundler-support" />
              ),
            }
          )}
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ReleaseHasUploadedArtifactsChecklistItem({
  sourceResolutionResults,
  shouldValidate,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const successMessage = t('Release has uploaded artifacts');
  const errorMessage = t("Release doesn't have uploaded artifacts");

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.releaseHasSomeArtifact) {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction type="muted">
        <h6>{t('No Uploaded Artifacts')}</h6>
        <p>
          {t(
            "The release this event belongs to doesn't have any uploaded artifacts. Upload your build artifacts to Sentry using the release:"
          )}{' '}
          <MonoBlock>{sourceResolutionResults.release}</MonoBlock>
        </p>
        <p>
          {tct(
            'Read the [link:Sentry Source Maps Documentation] to learn how to to upload your build artifacts to Sentry.',
            {
              link: (
                <ExternalLinkWithIcon href="https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/legacy-uploading-methods/" />
              ),
            }
          )}
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ReleaseSourceFileMatchingChecklistItem({
  sourceResolutionResults,
  shouldValidate,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const successMessage = t('Stack frame path matches a source file artifact name');
  const errorMessage = t("Stack frame path doesn't match a source file artifact name");

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.sourceFileReleaseNameFetchingResult === 'found') {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.sourceFileReleaseNameFetchingResult === 'wrong-dist') {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction type="muted">
          <h6>{t('Dist Value Not Matching')}</h6>
          <p>
            {t(
              'You uploaded a source file artifact with the right name, however the dist value on this event does not match the dist value on the artifact.'
            )}
          </p>
          {sourceResolutionResults.dist !== null ? (
            <p>
              {tct(
                'Upload your build artifacts to Sentry using the dist [dist] or adjust the dist value in your SDK options.',
                {dist: <MonoBlock>{sourceResolutionResults.dist}</MonoBlock>}
              )}
            </p>
          ) : (
            <p>
              {tct(
                'Upload your build artifacts to Sentry using a matching [dist] value or adjust the [dist] value in your SDK options.',
                {dist: <MonoBlock>dist</MonoBlock>}
              )}
            </p>
          )}
          <DistCodeSnippet />
          {/* TODO: Link to Uploaded Artifacts */}
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.stackFramePath === null) {
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction type="muted">
        <h6>{t('Stack Frame Without Path')}</h6>
        <p>
          {t(
            "This stack frame doesn't have a path. Check your SDK configuration to send a stack frame path!"
          )}
        </p>
      </CheckListInstruction>
    </CheckListItem>;
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction type="muted">
        <h6>{t('Stack Frame Not Matching Artifact Name')}</h6>
        <p>
          {tct(
            'The path for this stack frame is [stackFramePath] and the release value for this event is [release].',
            {
              stackFramePath: (
                <MonoBlock>{sourceResolutionResults.stackFramePath}</MonoBlock>
              ),
              release: <MonoBlock>{sourceResolutionResults.release}</MonoBlock>,
            }
          )}
        </p>
        <p>
          {t(
            "Sentry was not able to find a file in the release's artifacts that matches one of the following paths:"
          )}
        </p>
        <InstructionList>
          {sourceResolutionResults.matchingSourceFileNames.map(mathingSourceFileName => (
            <li key={mathingSourceFileName}>
              <MonoBlock>{mathingSourceFileName}</MonoBlock>
            </li>
          ))}
        </InstructionList>
        <p>
          {/* wrong-dist is not deterministically returned in the case of wrong dist values because of database restrictions */}
          {sourceResolutionResults.dist !== null
            ? tct(
                'This event has a dist value [dist]. Please check that you uploaded your artifacts with dist [dist].',
                {
                  dist: <MonoBlock>{sourceResolutionResults.dist}</MonoBlock>,
                }
              )
            : t(
                "This event doesn't have a dist value. Please check that you uploaded your artifacts without dist value."
              )}
        </p>
        {/* TODO: Link to uploaded files for this release. */}
        <p>
          {tct(
            'If the stack frame path is changing based on runtime parameters, you can use the [link:RewriteFrames integration] to dynamically change the the stack frame path.',
            {
              link: (
                <ExternalLinkWithIcon href="https://docs.sentry.io/platforms/javascript/configuration/integrations/rewriteframes/" />
              ),
            }
          )}
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ReleaseSourceMapMatchingChecklistItem({
  sourceResolutionResults,
  shouldValidate,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const successMessage = t('Source map reference matches a source map artifact name');
  const errorMessage = t("Source map reference doesn't match a source map artifact name");

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.sourceMapReleaseNameFetchingResult === 'found') {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.releaseSourceMapReference === null) {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction type="muted">
          <h6>{t('Missing Source Map Reference')}</h6>
          <p>
            {tct(
              'The source file for this stack frame is missing a source map reference. A source map reference is usually represented by a [sourceMappingUrl] comment at the bottom of your source file.',
              {sourceMappingUrl: <MonoBlock>//# sourceMappingURL=...</MonoBlock>}
            )}
          </p>
          <p>
            {tct(
              'You can fix this by configuring your build tool to emit a [sourceMappingUrl] comment.',
              {sourceMappingUrl: <MonoBlock>sourceMappingURL</MonoBlock>}
            )}
          </p>
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.sourceMapReleaseNameFetchingResult === 'wrong-dist') {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction type="muted">
          <h6>{t('Dist Value Not Matching')}</h6>
          <p>
            {t(
              'You uploaded a source map artifact with the right name, however the dist value on this event does not match the dist value on the artifact.'
            )}
          </p>
          {sourceResolutionResults.dist !== null ? (
            <p>
              {tct(
                'Upload your build artifacts to Sentry using the dist [dist] or adjust the dist value in your SDK options.',
                {dist: <MonoBlock>{sourceResolutionResults.dist}</MonoBlock>}
              )}
            </p>
          ) : (
            <p>
              {tct(
                'Upload your build artifacts to Sentry using a matching [dist] value or adjust the [dist] value in your SDK options.',
                {dist: <MonoBlock>dist</MonoBlock>}
              )}
            </p>
          )}
          <DistCodeSnippet />
          {/* TODO: Link to Uploaded Artifacts */}
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction type="muted">
        <h6>{t('Not Found')}</h6>
        <p>
          {tct(
            'The source file had a source map reference [sourceMapReference], but there was no source map artifact uploaded at that location. Make sure to generate and upload a source map named [matchingSourceMap] to symbolicate this stack frame!',
            {
              sourceMapReference: (
                <MonoBlock>{sourceResolutionResults.releaseSourceMapReference}</MonoBlock>
              ),
              matchingSourceMap: (
                <MonoBlock>{sourceResolutionResults.matchingSourceMapName}</MonoBlock>
              ),
            }
          )}
        </p>
        <p>
          {/* wrong-dist is not deterministically returned in the case of wrong dist values because of database restrictions */}
          {sourceResolutionResults.dist !== null
            ? tct(
                'This event has a dist value [dist]. Please check that you uploaded your sourcemaps with dist [dist].',
                {
                  dist: <MonoBlock>{sourceResolutionResults.dist}</MonoBlock>,
                }
              )
            : t(
                "This event doesn't have a dist value. Please check that you uploaded your sourcemaps without dist value."
              )}
        </p>
        {/* TODO: Link to Uploaded Artifacts */}
      </CheckListInstruction>
      <SourceMapStepNotRequiredNote />
    </CheckListItem>
  );
}

function ScrapingSourceFileAvailableChecklistItem({
  sourceResolutionResults,
}: {
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const successMessage = t('Source file available to Sentry');
  const errorMessage = t('Source file is not available to Sentry');

  if (sourceResolutionResults.sourceFileScrapingStatus.status === 'found') {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (
    sourceResolutionResults.uploadedSourceFileWithCorrectDebugId ||
    sourceResolutionResults.sourceFileReleaseNameFetchingResult === 'found' ||
    sourceResolutionResults.sourceFileScrapingStatus.status === 'none'
  ) {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction type="muted">
          <h6>{t('Fetching Not Attempted')}</h6>
          <p>
            {t(
              'The source file was already locaded via Debug IDs or Releases. Sentry will only attempt to fetch the source file from your servers as a fallback mechanism.'
            )}
          </p>
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction type="muted">
        <h6>{t('Error While Fetching')}</h6>
        <p>{t('Sentry encountered an error while fetching your source file.')}</p>
        <p>
          {t('Error message')}: "{sourceResolutionResults.sourceFileScrapingStatus.error}"
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ScrapingSourceMapAvailableChecklistItem({
  sourceResolutionResults,
  shouldValidate,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const successMessage = t('Source map available to Sentry');
  const errorMessage = t('Source map is not available to Sentry');

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.sourceMapScrapingStatus.status === 'found') {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.sourceMapScrapingStatus.status === 'none') {
    return <CheckListItem status="none" title={successMessage} />;
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction type="muted">
        <h6>{t('Error While Fetching')}</h6>
        <p>{t('Sentry encountered an error while fetching your source map.')}</p>
        <p>
          {t('Error message')}: "{sourceResolutionResults.sourceMapScrapingStatus.error}"
        </p>
      </CheckListInstruction>
      <SourceMapStepNotRequiredNote />
    </CheckListItem>
  );
}

function ExternalLinkWithIcon({href, children}: PropsWithChildren<{href: string}>) {
  return (
    <ExternalLink href={href}>
      {children} <IconOpen size="xs" />
    </ExternalLink>
  );
}

function DistCodeSnippet() {
  return (
    <InstructionCodeSnippet language="javascript" dark hideCopyButton>
      {`Sentry.init({
  dist: 'your-dist-name'
})`}
    </InstructionCodeSnippet>
  );
}

function VerifyAgainNote() {
  return (
    <CompletionNoteContainer>
      <IconRefresh size="lg" color="gray300" />
      <p>
        {t(
          'Once you changed your configuration, redeploy your app and capture a new event to verify your changes!'
        )}
      </p>
    </CompletionNoteContainer>
  );
}

function ChecklistDoneNote() {
  return (
    <CompletionNoteContainer>
      <IconCheckmark size="md" color="green200" />
      <p>
        {t(
          'You completed all of the steps above. Capture a new event to verify your setup!'
        )}
      </p>
    </CompletionNoteContainer>
  );
}

function SourceMapStepNotRequiredNote() {
  return (
    <CheckListInstruction type="muted" showIcon>
      {
        "You can safely ignore this step if you don't do any transformations to your code before deploying."
      }
    </CheckListInstruction>
  );
}

const StyledTabPanels = styled(TabPanels)`
  padding-top: ${space(2)};
`;

const CheckList = styled('ul')`
  margin: 0;
  padding: 0 ${space(1.5)};
  list-style-type: none;
`;

interface CheckListItemProps {
  status: 'none' | 'checked' | 'alert' | 'question';
  title: ReactNode;
}

const ListItemContainer = styled('li')`
  display: flex;

  &:last-of-type {
    .source-map-debugger-modal-checklist-line {
      display: none;
    }
  }
`;

const CheckMarkContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Line = styled('div')`
  margin: ${space(0.5)} 0;
  flex-grow: 1;
  width: ${space(0.25)};
  background-color: ${p => p.theme.gray200};
  border-radius: ${space(0.25)};
`;

const ListItemContentContainer = styled('div')`
  flex-grow: 1;
  margin-left: ${space(1.5)};
  padding-bottom: ${space(2)};
`;

const CompletionNoteContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
  margin-top: ${space(1)};
  margin-bottom: ${space(0.5)};
  padding: 0 ${space(2)} 0 0;
`;

const ListItemTitleWrapper = styled('div')`
  min-height: 20px;
  display: flex;
  align-items: center;
`;

const ListItemTitle = styled('p')<{status: 'none' | 'checked' | 'alert' | 'question'}>`
  font-weight: 600;
  color: ${p =>
    ({
      none: p.theme.gray300,
      question: p.theme.gray300,
      checked: p.theme.green300,
      alert: p.theme.yellow400,
    })[p.status]};
`;

const CheckListInstruction = styled(Alert)`
  width: 100%;
  margin-top: ${space(1)};
  margin-bottom: 0;
  overflow-x: auto;

  h6 {
    font-size: 1rem;
    margin-bottom: ${space(1)};
  }

  p {
    margin-bottom: ${space(1.5)};
  }
`;

const MonoBlock = styled('code')`
  padding: ${space(0.25)} ${space(0.5)};
  color: ${p => p.theme.gray400};
  background: ${p => p.theme.gray100};
  border: 1px solid ${p => p.theme.gray200};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-weight: 400;
  white-space: nowrap;
`;

const StyledProgressRing = styled(ProgressRing)`
  margin-right: ${space(0.5)};
`;

const WizardInstructionParagraph = styled('p')`
  margin-bottom: ${space(1)};
`;

const InstructionCodeSnippet = styled(CodeSnippet)`
  margin: ${space(1)} 0 ${space(2)};
`;

const InstructionList = styled('ul')`
  margin-bottom: ${space(1.5)};

  li {
    margin-bottom: ${space(0.5)};
  }
`;

const ModalHeadingContainer = styled('div')`
  display: flex;
  align-items: center;
`;
