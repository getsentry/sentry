import {Fragment, PropsWithChildren, ReactNode, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import {CodeSnippet} from 'sentry/components/codeSnippet';
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
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface SourceResolutionResults {
  distName: string | null;
  eventHasDebugIds: boolean;
  matchingArtifactName: string;
  projectHasUploadedArtifacts: boolean;
  releaseName: string | null;
  releaseSourceMapReference: string | null;
  sdkDebugIdSupport: 'full' | 'needs-upgrade' | 'unofficial-sdk';
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
  uploadedSomeArtifact: boolean;
  uploadedSomeArtifactToRelease: boolean;
  uploadedSomeArtifactWithDebugId: boolean;
  uploadedSourceFileWithCorrectDebugId: boolean;
  uploadedSourceMapWithCorrectDebugId: boolean;
  sdkVersion?: string;
}

interface SourceMapsDebuggerModalProps extends ModalRenderProps {
  sourceResolutionResults: SourceResolutionResults;
}

export function SourceMapsDebuggerModal({
  Body,
  Header,
  Footer,
  sourceResolutionResults,
}: SourceMapsDebuggerModalProps) {
  const theme = useTheme();

  let debugIdProgress = 0;
  if (sourceResolutionResults.sdkDebugIdSupport === 'full') {
    debugIdProgress++;
  }
  if (sourceResolutionResults.stackFrameDebugId !== null) {
    debugIdProgress++;
  }
  if (sourceResolutionResults.uploadedSourceFileWithCorrectDebugId) {
    debugIdProgress++;
  }
  if (sourceResolutionResults.uploadedSourceMapWithCorrectDebugId) {
    debugIdProgress++;
  }
  const debugIdProgressPercent = debugIdProgress / 4;

  let releaseNameProgress = 0;
  if (sourceResolutionResults.releaseName !== null) {
    releaseNameProgress++;
  }
  if (sourceResolutionResults.uploadedSomeArtifactToRelease) {
    releaseNameProgress++;
  }
  if (sourceResolutionResults.sourceFileReleaseNameFetchingResult === 'found') {
    releaseNameProgress++;
  }
  if (sourceResolutionResults.sourceMapReleaseNameFetchingResult === 'found') {
    releaseNameProgress++;
  }
  const releaseNameProgressPercent = releaseNameProgress / 4;

  let scrapingProgress = 0;
  if (sourceResolutionResults.sourceFileScrapingStatus.status === 'found') {
    scrapingProgress++;
  }
  if (sourceResolutionResults.sourceMapScrapingStatus.status === 'found') {
    scrapingProgress += 4;
  }
  const scrapingProgressPercent = scrapingProgress / 5;

  const [activeTab, setActiveTab] = useState<'debug-ids' | 'release' | 'fetching'>(() => {
    const possibleTabs = [
      {tab: 'debug-ids', progress: debugIdProgressPercent},
      {tab: 'release', progress: releaseNameProgressPercent},
      {tab: 'fetching', progress: scrapingProgressPercent},
    ] as const;

    // Get the tab with the most progress
    return possibleTabs.reduce(
      (prev, curr) => (curr.progress > prev.progress ? curr : prev),
      possibleTabs[0]
    ).tab;
  });

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Make Your Stack Traces Readable')}</h4>
      </Header>
      <Body>
        <p>
          Looks like it wasn't possible to determine the original source code for this
          Stack Frame when this event was captured. For Sentry to be able to unminify this
          Stack Frame you need to configure source maps.
        </p>
        <WizardInstructionParagraph>
          The easiest way to get started using source maps is running the Sentry Source
          Map Wizard in the terminal inside your project:
        </WizardInstructionParagraph>
        <InstructionCodeSnippet language="bash" dark>
          {'npx @sentry/wizard@latest -i sourcemaps'}
        </InstructionCodeSnippet>
        <p>
          There are three different ways you can configure source maps. Once you're
          getting started with source maps, the following check lists will help you set
          them up correctly. Complete any one of the following processes:
        </p>
        <Tabs<'debug-ids' | 'release' | 'fetching'>
          value={activeTab}
          onChange={tab => {
            setActiveTab(tab);
          }}
        >
          <TabList>
            <TabList.Item key="debug-ids" textValue={`Debug IDs (${debugIdProgress}/4)`}>
              <StyledProgressRing
                progressColor={
                  activeTab === 'debug-ids' ? theme.purple300 : theme.gray300
                }
                backgroundColor={theme.gray200}
                value={debugIdProgressPercent * 100}
                size={16}
                barWidth={4}
              />
              {t('Debug IDs (recommended)')}
            </TabList.Item>
            <TabList.Item
              key="release"
              textValue={`Release Name (${releaseNameProgress}/4)`}
            >
              <StyledProgressRing
                progressColor={activeTab === 'release' ? theme.purple300 : theme.gray300}
                backgroundColor={theme.gray200}
                value={releaseNameProgressPercent * 100}
                size={16}
                barWidth={4}
              />
              {t('Releases')}
            </TabList.Item>
            <TabList.Item key="fetching" textValue={`Fetching (${scrapingProgress}/4)`}>
              <StyledProgressRing
                progressColor={activeTab === 'fetching' ? theme.purple300 : theme.gray300}
                backgroundColor={theme.gray200}
                value={scrapingProgressPercent * 100}
                size={16}
                barWidth={4}
              />
              {t('Hosting Publicly')}
            </TabList.Item>
          </TabList>
          <StyledTabPanels>
            <TabPanels.Item key="debug-ids">
              <p>
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/artifact-bundles/">
                  Debug IDs <IconOpen size="xs" />
                </ExternalLink>{' '}
                are a way of matching your source files to source maps. Follow all of the
                steps below to get a readable stack trace:
              </p>
              <CheckList>
                <InstalledSdkChecklistItem
                  setActiveTab={setActiveTab}
                  sourceResolutionResults={sourceResolutionResults}
                />
                <HasDebugIdChecklistItem
                  sourceResolutionResults={sourceResolutionResults}
                />
                <UploadedSourceFileWithCorrectDebugIdChecklistItem
                  sourceResolutionResults={sourceResolutionResults}
                />
                <UploadedSourceMapWithCorrectDebugIdChecklistItem
                  sourceResolutionResults={sourceResolutionResults}
                />
              </CheckList>
              {debugIdProgressPercent === 1 ? <ChecklistDoneNote /> : <VerifyAgainNote />}
            </TabPanels.Item>
            <TabPanels.Item key="release">
              <p>
                You can match your stack trace to your source code based on{' '}
                <ExternalLink href="https://docs.sentry.io/product/releases/">
                  Releases <IconOpen size="xs" />
                </ExternalLink>{' '}
                and artifact names. Follow all of the steps below to get a readable stack
                trace:
              </p>
              <CheckList>
                <EventHasReleaseNameChecklistItem
                  sourceResolutionResults={sourceResolutionResults}
                />
                <ReleaseHasUploadedArtifactsChecklistItem
                  sourceResolutionResults={sourceResolutionResults}
                />
                <ReleaseSourceFileMatchingChecklistItem
                  sourceResolutionResults={sourceResolutionResults}
                />
                <ReleaseSourceMapMatchingChecklistItem
                  sourceResolutionResults={sourceResolutionResults}
                />
              </CheckList>
              {releaseNameProgressPercent === 1 ? (
                <ChecklistDoneNote />
              ) : (
                <VerifyAgainNote />
              )}
            </TabPanels.Item>
            <TabPanels.Item key="fetching">
              <CheckList>
                <ScrapingSourceFileAvailableChecklistItem
                  sourceResolutionResults={sourceResolutionResults}
                />
                <ScrapingSourceMapAvailableChecklistItem
                  sourceResolutionResults={sourceResolutionResults}
                />
              </CheckList>
              {scrapingProgressPercent === 1 ? (
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
                feedbackTypes={['This was helpful', 'This was not helpful']}
                {...modalProps}
              />
            ));
          }}
        >
          Was this helpful? <IconMegaphone size="xs" />
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
  sourceResolutionResults: SourceResolutionResults;
}) {
  const itemName = 'Installed SDK supports Debug IDs';

  if (sourceResolutionResults.sdkDebugIdSupport === 'needs-upgrade') {
    return (
      <CheckListItem status="alert" title={itemName}>
        <CheckListInstruction type="muted">
          <h6>Outdated SDK</h6>
          {sourceResolutionResults.sdkVersion ? (
            <p>
              You are using version{' '}
              <MonoBlock>{sourceResolutionResults.sdkVersion}</MonoBlock> of the Sentry
              SDK which does not support debug IDs. You should upgrade to at least version{' '}
              <MonoBlock>7.56.0</MonoBlock>.
            </p>
          ) : (
            <p>
              You are using an outdated version of the Sentry SDK which does not support
              debug IDs. You should upgrade to at least version{' '}
              <MonoBlock>7.56.0</MonoBlock>.
            </p>
          )}
          <p>
            If upgrading the SDK is not an option for you, you can use the{' '}
            <Link
              to=""
              onClick={() => {
                setActiveTab('release');
              }}
            >
              Release Name
            </Link>
            process instead.
          </p>
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  if (
    sourceResolutionResults.stackFrameDebugId !== null ||
    sourceResolutionResults.sdkDebugIdSupport === 'full'
  ) {
    return <CheckListItem status="checked" title={itemName} />;
  }

  return (
    <CheckListItem status="question" title={itemName}>
      <CheckListInstruction type="muted">
        <h6>Unofficial SDK</h6>
        <p>
          You are using an unofficial Sentry SDK. Please check whether this SDK already
          supports Debug IDs. It's possible that this SDK supports debug IDs but you may
          be better off using the{' '}
          <Link
            to=""
            onClick={() => {
              setActiveTab('release');
            }}
          >
            Release Name
          </Link>{' '}
          method of uploading source maps.
        </p>
        <p>
          If this SDK depends on an official Sentry SDK, the earliest version that
          supports Debug IDs is version 7.56.0
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function HasDebugIdChecklistItem({
  sourceResolutionResults,
}: {
  sourceResolutionResults: SourceResolutionResults;
}) {
  const itemName = 'Stack frame has Debug IDs';

  if (sourceResolutionResults.stackFrameDebugId !== null) {
    return <CheckListItem status="checked" title={itemName} />;
  }

  if (sourceResolutionResults.sdkDebugIdSupport === 'needs-upgrade') {
    return <CheckListItem status="none" title={itemName} />;
  }

  if (sourceResolutionResults.eventHasDebugIds) {
    return (
      <CheckListItem status="alert" title={itemName}>
        <CheckListInstruction type="muted">
          <h6>Source Is Missing Injection</h6>
          <p>
            The event already has debug IDs for some stack frames but not for this one.
            Please configure the tool you are using to upload source maps to inject debug
            IDs into <b>all</b> of your build artifacts.
          </p>
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.uploadedSomeArtifactWithDebugId) {
    return (
      <CheckListItem status="alert" title={itemName}>
        <CheckListInstruction type="muted">
          <h6>Uploaded Files Not Deployed</h6>
          <p>
            It seems you already uploaded artifacts with Debug IDs, however, this event
            doesn't contain any Debug IDs yet. Make sure to also deploy the artifacts you
            uploaded to Sentry. For Sentry to be able to show your original source code,
            it is required that you deploy the exact same files that you uploaded to
            Sentry.
          </p>
          <p>
            Read the{' '}
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/">
              Sentry Source Maps Documentation <IconOpen size="xs" />
            </ExternalLink>{' '}
            to learn how to inject Debug IDs into your build artifacts and how to upload
            them to Sentry.
          </p>
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={itemName}>
      <CheckListInstruction type="muted">
        <h6>No Debug ID Tooling Used</h6>
        <p>
          This event doesn't contain any Debug IDs. Read the{' '}
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/">
            Sentry Source Maps Documentation <IconOpen size="xs" />
          </ExternalLink>{' '}
          to learn how to inject Debug IDs into your build artifacts and how to upload
          them to Sentry.
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function UploadedSourceFileWithCorrectDebugIdChecklistItem({
  sourceResolutionResults,
}: {
  sourceResolutionResults: SourceResolutionResults;
}) {
  const itemName = 'Uploaded source file with a matching Debug ID';

  if (sourceResolutionResults.stackFrameDebugId === null) {
    return <CheckListItem status="none" title={itemName} />;
  }

  if (sourceResolutionResults.uploadedSourceFileWithCorrectDebugId) {
    return <CheckListItem status="checked" title={itemName} />;
  }

  if (sourceResolutionResults.uploadedSomeArtifactWithDebugId) {
    return (
      <CheckListItem status="alert" title={itemName}>
        <CheckListInstruction type="muted">
          <h6>No Soure File With Matching Debug ID</h6>
          <p>
            You already uploaded artifacts with Debug IDs but none of the uploaded source
            files had a Debug ID matching this stack frame's Debug ID:{' '}
            {<MonoBlock>Debug ID: {sourceResolutionResults.stackFrameDebugId}</MonoBlock>}
          </p>
          <p>
            Make sure to inject Debug IDs into all of your source files and to upload all
            of them to Sentry.
          </p>
          {/* TODO: Link to Uploaded Artifacts */}
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.uploadedSomeArtifact) {
    return (
      <CheckListItem status="alert" title={itemName}>
        <CheckListInstruction type="muted">
          <h6>Uploaded Artifacts Without Debug IDs</h6>
          <p>
            You already uploaded artifacts for this project but none of the artifacts
            contain Debug IDs. Make sure you inject Debug IDs into your source files
            before uploading them to Sentry.
          </p>
          <p>
            Read the{' '}
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/">
              Sentry Source Maps Documentation <IconOpen size="xs" />
            </ExternalLink>{' '}
            to learn how to inject Debug IDs into your build artifacts and how to upload
            them to Sentry.
          </p>
          {/* TODO: Link to Uploaded Artifacts */}
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={itemName}>
      <CheckListInstruction type="muted">
        <h6>No Artifacts Uploaded</h6>
        <p>
          You didn't upload any artifacts yet. Read the{' '}
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/">
            Sentry Source Maps Documentation <IconOpen size="xs" />
          </ExternalLink>{' '}
          to learn how to inject Debug IDs into your build artifacts and how to upload
          them to Sentry.
        </p>
        {/* TODO: Link to Uploaded Artifacts */}
      </CheckListInstruction>
    </CheckListItem>
  );
}

function UploadedSourceMapWithCorrectDebugIdChecklistItem({
  sourceResolutionResults,
}: {
  sourceResolutionResults: SourceResolutionResults;
}) {
  const itemName = 'Uploaded source map with a matching Debug ID';

  if (
    sourceResolutionResults.stackFrameDebugId === null ||
    !sourceResolutionResults.uploadedSourceFileWithCorrectDebugId
  ) {
    return <CheckListItem status="none" title={itemName} />;
  }

  if (sourceResolutionResults.uploadedSourceMapWithCorrectDebugId) {
    return <CheckListItem status="checked" title={itemName} />;
  }

  if (sourceResolutionResults.uploadedSomeArtifactWithDebugId) {
    return (
      <CheckListItem status="alert" title={itemName}>
        <CheckListInstruction type="muted">
          <h6>No Soure Map With Matching Debug ID</h6>
          <p>
            You already uploaded artifacts with Debug IDs but none of the uploaded source
            maps had a Debug ID matching this stack frame's Debug ID:{' '}
            {<MonoBlock>Debug ID: {sourceResolutionResults.stackFrameDebugId}</MonoBlock>}
          </p>
          <p>
            Make sure to inject Debug IDs into all of your source files and to upload all
            of them to Sentry.
          </p>
          {/* TODO: Link to Uploaded Artifacts */}
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.uploadedSomeArtifact) {
    return (
      <CheckListItem status="alert" title={itemName}>
        <CheckListInstruction type="muted">
          <h6>Uploaded Artifacts Without Debug IDs</h6>
          <p>
            You already uploaded artifacts for this project but none of the artifacts
            contain Debug IDs. Make sure you inject Debug IDs into your source files
            before uploading them to Sentry.
          </p>
          <p>
            Read the{' '}
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/">
              Sentry Source Maps Documentation <IconOpen size="xs" />
            </ExternalLink>{' '}
            to learn how to inject Debug IDs into your build artifacts and how to upload
            them to Sentry.
          </p>
          {/* TODO: Link to Uploaded Artifacts */}
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={itemName}>
      <CheckListInstruction type="muted">
        <h6>No Artifacts Uploaded</h6>
        <p>
          You didn't upload any artifacts yet. Read the{' '}
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/">
            Sentry Source Maps Documentation <IconOpen size="xs" />
          </ExternalLink>{' '}
          to learn how to inject Debug IDs into your build artifacts and how to upload
          them to Sentry.
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
  sourceResolutionResults: SourceResolutionResults;
}) {
  const itemName = 'Event has release value';

  if (sourceResolutionResults.releaseName !== null) {
    return <CheckListItem status="checked" title={itemName} />;
  }

  return (
    <CheckListItem status="alert" title={itemName}>
      <CheckListInstruction type="muted">
        <h6>No Release Value</h6>
        <p>
          The captured event does not have a <MonoBlock>release</MonoBlock> value.
          Configure a <MonoBlock>release</MonoBlock> value in the SDK:
        </p>
        <InstructionCodeSnippet language="javascript" dark hideCopyButton>
          {`Sentry.init({
  release: 'your-release-name'
})`}
        </InstructionCodeSnippet>
        <p>
          Alternatively, you can configure one of our build tools to automatically inject
          a release value into your code:{' '}
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/#sentry-bundler-support">
            Sentry Bundler Support <IconOpen size="xs" />
          </ExternalLink>
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ReleaseHasUploadedArtifactsChecklistItem({
  sourceResolutionResults,
}: {
  sourceResolutionResults: SourceResolutionResults;
}) {
  const itemName = 'Release has uploaded artifacts';

  if (sourceResolutionResults.releaseName === null) {
    return <CheckListItem status="none" title={itemName} />;
  }

  if (sourceResolutionResults.uploadedSomeArtifactToRelease) {
    return <CheckListItem status="checked" title={itemName} />;
  }

  return (
    <CheckListItem status="alert" title={itemName}>
      <CheckListInstruction type="muted">
        <h6>No Uploaded Artifacts</h6>
        <p>
          The release this event belongs to doesn't have any uploaded artifacts. Upload
          your build artifacts to Sentry using the release:{' '}
          <MonoBlock>{sourceResolutionResults.releaseName}</MonoBlock>
        </p>
        <p>
          Read the{' '}
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/legacy-uploading-methods/">
            Sentry Source Maps Documentation <IconOpen size="xs" />
          </ExternalLink>{' '}
          to learn how to to upload your build artifacts to Sentry.
          {/* TODO: Link to Uploaded Artifacts */}
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ReleaseSourceFileMatchingChecklistItem({
  sourceResolutionResults,
}: {
  sourceResolutionResults: SourceResolutionResults;
}) {
  const itemName = 'Stack frame path matches source file artifact';

  if (!sourceResolutionResults.uploadedSomeArtifactToRelease) {
    return <CheckListItem status="none" title={itemName} />;
  }

  if (sourceResolutionResults.sourceFileReleaseNameFetchingResult === 'found') {
    return <CheckListItem status="checked" title={itemName} />;
  }

  if (sourceResolutionResults.sourceFileReleaseNameFetchingResult === 'wrong-dist') {
    return (
      <CheckListItem status="alert" title={itemName}>
        <CheckListInstruction type="muted">
          <h6>Dist Value Not Matching</h6>
          <p>
            You uploaded a source file artifact with the right name, however the dist
            value on this event does not match the dist value on the artifact.
          </p>
          {sourceResolutionResults.distName !== null ? (
            <p>
              Upload your build artifacts to Sentry using the dist{' '}
              <MonoBlock>{sourceResolutionResults.distName}</MonoBlock> or adjust the dist
              value in your SDK options.
            </p>
          ) : (
            <p>
              Upload your build artifacts to Sentry using a matching
              <MonoBlock>dist</MonoBlock> value or adjust the <MonoBlock>dist</MonoBlock>{' '}
              value in your SDK options.
            </p>
          )}
          <DistCodeSnippet />
          {/* TODO: Link to Uploaded Artifacts */}
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.stackFramePath === null) {
    <CheckListItem status="alert" title={itemName}>
      <CheckListInstruction type="muted">
        <h6>Stack Frame Without Path</h6>
        <p>
          This stack frame doesn't have a path. Check your SDK configuration to send a
          stack frame path!
        </p>
      </CheckListInstruction>
    </CheckListItem>;
  }

  return (
    <CheckListItem status="alert" title={itemName}>
      <CheckListInstruction type="muted">
        <h6>Stack Frame Not Matching Artifact Name</h6>
        <p>
          The path for this stack frame is{' '}
          <MonoBlock>{sourceResolutionResults.stackFramePath}</MonoBlock> and no matching
          artifact in this release was found.
        </p>
        <p>
          Upload a source file with exactly the same name or a protocol + hostname prefix:{' '}
          <MonoBlock>{sourceResolutionResults.matchingArtifactName}</MonoBlock>
        </p>
        <p>
          Refer to the documentation of the tool you're using to upload source files to
          understand how to change artifact names.
        </p>
        <p>
          If the stack frame path is changing based on runtime parameters, you can use the{' '}
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/configuration/integrations/rewriteframes/">
            RewriteFrames integration <IconOpen size="xs" />
          </ExternalLink>{' '}
          to dynamically change the the stack frame path.
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ReleaseSourceMapMatchingChecklistItem({
  sourceResolutionResults,
}: {
  sourceResolutionResults: SourceResolutionResults;
}) {
  const itemName = 'Source map reference matches source map artifact name';

  if (sourceResolutionResults.sourceFileReleaseNameFetchingResult !== 'found') {
    return <CheckListItem status="none" title={itemName} />;
  }

  if (sourceResolutionResults.sourceMapReleaseNameFetchingResult === 'found') {
    return <CheckListItem status="checked" title={itemName} />;
  }

  if (sourceResolutionResults.releaseSourceMapReference === null) {
    return (
      <CheckListItem status="alert" title={itemName}>
        <CheckListInstruction type="muted">
          <h6>Missing Source Map Reference</h6>
          <p>
            The source file for this stack frame is missing a source map reference. A
            source map reference is usually represented by a{' '}
            <MonoBlock>//# sourceMappingURL=...</MonoBlock> comment at the bottom of your
            source file.
          </p>
          <p>
            You can fix this by configuring your build tool to emit a{' '}
            <MonoBlock>sourceMappingURL</MonoBlock> comment.
          </p>
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.sourceMapReleaseNameFetchingResult === 'wrong-dist') {
    return (
      <CheckListItem status="alert" title={itemName}>
        <CheckListInstruction type="muted">
          <h6>Dist Value Not Matching</h6>
          <p>
            You uploaded a source map artifact with the right name, however the dist value
            on this event does not match the dist value on the artifact.
          </p>
          {sourceResolutionResults.distName !== null ? (
            <p>
              Upload your build artifacts to Sentry using the dist{' '}
              <MonoBlock>{sourceResolutionResults.distName}</MonoBlock> or adjust the dist
              value in your SDK options.
            </p>
          ) : (
            <p>
              Upload your build artifacts to Sentry using a matching
              <MonoBlock>dist</MonoBlock> value or adjust the <MonoBlock>dist</MonoBlock>{' '}
              value in your SDK options.
            </p>
          )}
          <DistCodeSnippet />
          {/* TODO: Link to Uploaded Artifacts */}
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={itemName}>
      <CheckListInstruction type="muted">
        <h6>Not Found</h6>
        <p>
          The source file had a source map reference{' '}
          <MonoBlock>{sourceResolutionResults.releaseSourceMapReference}</MonoBlock>, but
          there was no source map artifact uploaded at that location. Make sure to
          generate and upload all of your source maps!
        </p>
        <p>
          Note, that if the source map reference is a relative path, Sentry will look for
          a source map artifact relative to the source file that contains the source map
          reference.
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
  sourceResolutionResults: SourceResolutionResults;
}) {
  const itemName = 'Source file available to Sentry';

  if (sourceResolutionResults.sourceFileScrapingStatus.status === 'found') {
    return <CheckListItem status="checked" title={itemName} />;
  }

  if (
    sourceResolutionResults.uploadedSourceFileWithCorrectDebugId ||
    sourceResolutionResults.sourceFileReleaseNameFetchingResult === 'found' ||
    sourceResolutionResults.sourceFileScrapingStatus.status === 'none'
  ) {
    return (
      <CheckListItem status="alert" title={itemName}>
        <CheckListInstruction type="muted">
          <h6>Fetching Not Attempted</h6>
          <p>
            The source file was already locaded via Debug IDs or Releases. Sentry will
            only attempt to fetch the source file from your servers as a fallback
            mechanism.
          </p>
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={itemName}>
      <CheckListInstruction type="muted">
        <h6>Error While Fetching</h6>
        <p>Sentry encountered an error while fetching your source file.</p>
        <p>Error message: "{sourceResolutionResults.sourceFileScrapingStatus.error}"</p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ScrapingSourceMapAvailableChecklistItem({
  sourceResolutionResults,
}: {
  sourceResolutionResults: SourceResolutionResults;
}) {
  const itemName = 'Source map available to Sentry';

  if (sourceResolutionResults.sourceMapScrapingStatus.status === 'found') {
    return <CheckListItem status="checked" title={itemName} />;
  }

  if (sourceResolutionResults.sourceFileScrapingStatus.status === 'none') {
    return <CheckListItem status="none" title={itemName} />;
  }

  if (sourceResolutionResults.sourceMapScrapingStatus.status === 'none') {
    return <CheckListItem status="none" title={itemName} />;
  }

  return (
    <CheckListItem status="alert" title={itemName}>
      <CheckListInstruction type="muted">
        <h6>Error While Fetching</h6>
        <p>Sentry encountered an error while fetching your source map.</p>
        <p>Error message: "{sourceResolutionResults.sourceMapScrapingStatus.error}"</p>
      </CheckListInstruction>
      <SourceMapStepNotRequiredNote />
    </CheckListItem>
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
        Once you changed your configuration, redeploy your app and capture a new event to
        verify your changes!
      </p>
    </CompletionNoteContainer>
  );
}

function ChecklistDoneNote() {
  return (
    <CompletionNoteContainer>
      <IconCheckmark size="md" color="green200" />
      <p>
        You completed all of the steps above. Capture a new event to verify your setup!
      </p>
    </CompletionNoteContainer>
  );
}

function SourceMapStepNotRequiredNote() {
  return (
    <CheckListInstruction type="muted" showIcon>
      You can safely ignore this step if you don't do any transformations to your code
      before deploying.
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
    }[p.status])};
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
