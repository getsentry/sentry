import {Fragment, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {IconFile, IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {parseDashboardExport} from 'sentry/views/dashboards/exportDashboard';
import {
  assignDefaultLayout,
  assignTempId,
  getInitialColumnDepths,
} from 'sentry/views/dashboards/layoutUtils';
import {enforceLayoutMinHeight} from 'sentry/views/dashboards/utils/enforceLayoutMinHeight';

export interface ImportDashboardFromFileModalProps {
  organization: Organization;
}

function ImportDashboardFromFileModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
}: ModalRenderProps & ImportDashboardFromFileModalProps) {
  const navigate = useNavigate();
  const [parseError, setParseError] = useState('');
  const [file, setFile] = useState<File>();
  const [dragCounter, setDragCounter] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function processFile(selectedFile: File) {
    if (selectedFile.type !== 'application/json') {
      addErrorMessage(t('You must upload a JSON file'));
      setFile(undefined);
      setParseError('');
      return;
    }
    setFile(selectedFile);
    setParseError('');
  }

  function handleImport() {
    if (!file) {
      return;
    }

    const fileReader = new FileReader();
    fileReader.readAsText(file, 'UTF-8');
    fileReader.onload = event => {
      const target = event.target;
      if (target && typeof target.result === 'string') {
        try {
          const parsed = JSON.parse(target.result);
          const dashboard = parseDashboardExport(parsed);
          const widgets = enforceLayoutMinHeight(
            assignDefaultLayout(
              dashboard.widgets.map(assignTempId),
              getInitialColumnDepths()
            )
          );

          closeModal();
          navigate(normalizeUrl(`/organizations/${organization.slug}/dashboards/new/`), {
            state: {importedDashboard: {...dashboard, widgets}},
          });
        } catch (error) {
          setParseError(
            error instanceof Error ? error.message : t('Could not parse dashboard file')
          );
        }
      }
    };
  }

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Import Dashboard')}</h4>
      </Header>
      <Body>
        <Stack gap="lg">
          <Text as="p" size="md">
            {t(
              'Upload a JSON file exported from Sentry to create a new dashboard with the same configuration.'
            )}
          </Text>
          {parseError && (
            <Alert.Container>
              <Alert variant="danger" showIcon>
                {parseError}
              </Alert>
            </Alert.Container>
          )}
          {file ? (
            <SelectedFileWell>
              <Flex align="center" gap="md">
                <IconFile size="md" />
                <Stack gap="xs">
                  <Text size="md" bold>
                    {file.name}
                  </Text>
                  <Text size="sm" variant="secondary">
                    {(file.size / 1024).toFixed(1)} KB
                  </Text>
                </Stack>
              </Flex>
              <Button
                size="xs"
                variant="transparent"
                onClick={() => {
                  setFile(undefined);
                  setParseError('');
                  if (inputRef.current) {
                    inputRef.current.value = '';
                  }
                }}
              >
                {t('Remove')}
              </Button>
            </SelectedFileWell>
          ) : (
            <DropZone
              onDragEnter={e => {
                e.preventDefault();
                setDragCounter(c => c + 1);
              }}
              onDragOver={e => e.preventDefault()}
              onDragLeave={() => setDragCounter(c => c - 1)}
              onDrop={e => {
                e.preventDefault();
                setDragCounter(0);
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile) {
                  processFile(droppedFile);
                }
              }}
              onClick={() => inputRef.current?.click()}
              draggedOver={dragCounter > 0}
            >
              <IconUpload size="xl" />
              <Text size="md" variant="secondary">
                {t('Drag and drop a JSON file here, or')}
              </Text>
              <Button size="sm" variant="secondary">
                {t('Browse Files')}
              </Button>
              <HiddenInput
                ref={inputRef}
                type="file"
                accept=".json"
                onChange={e => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) {
                    processFile(selectedFile);
                  }
                }}
              />
            </DropZone>
          )}
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button size="sm" onClick={closeModal}>
            {t('Cancel')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!file}
            onClick={handleImport}
            icon={<IconUpload />}
          >
            {t('Import & Preview')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

export default ImportDashboardFromFileModal;

export const modalCss = css`
  max-width: 500px;
  margin: 70px auto;
`;

const DropZone = styled('div')<{draggedOver: boolean}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space['2xl']};
  border-radius: 4px;
  border: 1px ${p => (p.draggedOver ? 'solid' : 'dashed')}
    ${p => p.theme.tokens.border.primary};
  background: ${p =>
    p.draggedOver
      ? p.theme.tokens.background.transparent.accent.muted
      : p.theme.tokens.background.secondary};
  cursor: pointer;
  transition: background 0.1s ease;

  &:hover {
    background: ${p => p.theme.tokens.background.transparent.accent.muted};
  }
`;

const SelectedFileWell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  border-radius: 4px;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
`;

const HiddenInput = styled('input')`
  display: none;
`;
