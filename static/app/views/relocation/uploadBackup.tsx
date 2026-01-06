import {useRef, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {IconDelete, IconFile, IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import {useUser} from 'sentry/utils/useUser';
import StepHeading from 'sentry/views/relocation/components/stepHeading';

import type {StepProps} from './types';

const DEFAULT_ERROR_MSG = t(
  'An error has occurred while trying to start relocation job. Please contact support for further assistance.'
);
const IN_PROGRESS_RELOCATION_ERROR_MSG = t(
  'You already have an in-progress relocation job.'
);
const THROTTLED_RELOCATION_ERROR_MSG = t(
  'We have reached the daily limit of relocations - please try again tomorrow, or contact support.'
);
const SESSION_EXPIRED_ERROR_MSG = t('Your session has expired.');

export function UploadBackup({relocationState, onComplete}: StepProps) {
  const api = useApi({
    api: new Client({headers: {Accept: 'application/json; charset=utf-8'}}),
  });
  const [file, setFile] = useState<File>();
  const [dragCounter, setDragCounter] = useState(0);
  const inputFileRef = useRef<HTMLInputElement>(null);
  const user = useUser();

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    setDragCounter(dragCounter + 1);
  };

  const handleDragLeave = () => {
    setDragCounter(dragCounter - 1);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragCounter(0);

    setFile(event.dataTransfer.files[0]);
  };

  const handleFileChange = (event: any) => {
    const newFile = event.target.files?.[0];

    // No file selected (e.g. user clicked "cancel")
    if (!newFile) {
      return;
    }

    setFile(newFile);
  };

  const onFileUploadLinkClick = () => {
    inputFileRef.current?.click();
  };

  const handleStartRelocation = async () => {
    const {orgSlugs, regionUrl, promoCode} = relocationState;
    if (!orgSlugs || !regionUrl || !file) {
      addErrorMessage(DEFAULT_ERROR_MSG);
      return;
    }
    const formData = new FormData();
    formData.set('orgs', orgSlugs);
    formData.set('file', file);
    formData.set('owner', user.username);
    if (promoCode) {
      formData.set('promo_code', promoCode);
    }
    try {
      const result = await api.requestPromise(`/relocations/`, {
        method: 'POST',
        host: regionUrl,
        data: formData,
      });

      addSuccessMessage(
        t(
          "Your relocation has started - we'll email you with updates as soon as we have 'em!"
        )
      );
      onComplete(result.uuid);
    } catch (error: any) {
      if (error.status === 409) {
        addErrorMessage(IN_PROGRESS_RELOCATION_ERROR_MSG);
      } else if (error.status === 429) {
        addErrorMessage(THROTTLED_RELOCATION_ERROR_MSG);
      } else if (error.status === 401) {
        addErrorMessage(SESSION_EXPIRED_ERROR_MSG);
      } else {
        addErrorMessage(DEFAULT_ERROR_MSG);
      }
    }
  };

  return (
    <Wrapper data-test-id="upload-backup">
      <StepHeading step={4}>
        {t('Upload Tarball to begin the relocation process')}
      </StepHeading>
      <motion.div
        transition={testableTransition()}
        variants={{
          initial: {y: 30, opacity: 0},
          animate: {y: 0, opacity: 1},
          exit: {opacity: 0},
        }}
      >
        <p>
          {t(
            "Nearly done! Just upload your tarball here, and we'll send you an email when everything is ready to go!"
          )}
        </p>
        {file ? (
          <FinishedWell>
            <IconFile size="lg" />
            <Flex align="center" gap="xs">
              <div>{file.name}</div>
              <Button
                aria-label={t('Remove file')}
                icon={<IconDelete />}
                borderless
                size="xs"
                onClick={() => setFile(undefined)}
              />
            </Flex>
            <Button
              priority="primary"
              onClick={handleStartRelocation}
              icon={<IconUpload className="upload-icon" size="xs" />}
            >
              {t('Start Relocation')}
            </Button>
          </FinishedWell>
        ) : (
          <UploadWell
            onDragEnter={handleDragEnter}
            onDragOver={event => event.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-label={t('dropzone')}
            draggedOver={dragCounter > 0}
          >
            <StyledUploadIcon className="upload-icon" size="xl" />
            <UploadWrapper>
              <p>{t('Drag and Drop file here or')}</p>
              <a onClick={onFileUploadLinkClick}>{t('Choose file')}</a>
              <UploadInput
                name="file"
                type="file"
                aria-label={t('file-upload')}
                accept=".tar"
                ref={inputFileRef}
                onChange={e => handleFileChange(e)}
                hidden
                title=""
              />
            </UploadWrapper>
          </UploadWell>
        )}
      </motion.div>
    </Wrapper>
  );
}

const StyledUploadIcon = styled(IconUpload)`
  margin-top: ${space(2)};
  margin-bottom: ${space(1)};
`;

const Wrapper = styled('div')`
  max-width: 769px;
  max-height: 525px;
  margin-left: auto;
  margin-right: auto;
  padding: ${space(4)};
  background-color: ${p => p.theme.colors.surface500};
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  width: 100%;
  font-size: 16px;
  color: ${p => p.theme.subText};
  mark {
    border-radius: 8px;
    padding: ${space(0.25)} ${space(0.5)} ${space(0.25)} ${space(0.5)};
    background: ${p => p.theme.colors.gray100};
    margin-right: ${space(1)};
  }
  h2 {
    color: ${p => p.theme.colors.gray800};
  }
  p {
    margin-bottom: ${space(1)};
  }
  .encrypt-help {
    color: ${p => p.theme.colors.gray800};
  }
`;

const FinishedWell = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  gap: ${space(1)};
  align-items: center;

  justify-content: center;
  margin: ${space(2)} 0;
  padding: ${space(2)} ${space(3)};
  border-radius: 3px;
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
`;

const UploadWell = styled('div')<{draggedOver: boolean}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: ${space(2)} 0;
  padding: ${space(2)} ${space(3)};
  height: 140px;
  border-radius: 3px;
  border: 1px ${props => (props.draggedOver ? 'solid' : 'dashed')} ${p => p.theme.border};
  background: ${props =>
    props.draggedOver ? p => p.theme.colors.blue100 : p => p.theme.colors.surface500};

  .upload-icon {
    color: ${p => p.theme.colors.gray800};
  }
`;

const UploadInput = styled('input')`
  opacity: 0;
`;

const UploadWrapper = styled('div')`
  display: flex;
  justify-content: center;
  a {
    padding-left: ${space(0.5)};
  }
  input[type='file'] {
    display: none;
  }
`;
