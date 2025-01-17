import {useRef, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import Well from 'sentry/components/well';
import {IconFile, IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import {useUser} from 'sentry/utils/useUser';
import StepHeading from 'sentry/views/relocation/components/stepHeading';

import type {StepProps} from './types';

type UploadWellProps = {
  centered: boolean;
  draggedOver: boolean;
  onDragEnter: Function;
  onDragLeave: Function;
  onDragOver: Function;
  onDrop: Function;
};

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

  const handleDragEnter = (event: any) => {
    event.preventDefault();
    setDragCounter(dragCounter + 1);
  };

  const handleDragLeave = () => {
    setDragCounter(dragCounter - 1);
  };

  const handleDrop = (event: any) => {
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
    } catch (error) {
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
          <FinishedWell centered>
            <IconFile className="file-icon" size="xl" />
            <div>
              <p>{file.name}</p>
              <a onClick={() => setFile(undefined)}>{t('Remove file')}</a>
            </div>
            <StartRelocationButton
              priority="primary"
              onClick={handleStartRelocation}
              icon={<IconUpload className="upload-icon" size="xs" />}
            >
              {t('Start Relocation')}
            </StartRelocationButton>
          </FinishedWell>
        ) : (
          <UploadWell
            onDragEnter={handleDragEnter}
            onDragOver={event => event.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            centered
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

export default UploadBackup;

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
  background-color: ${p => p.theme.surface400};
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  width: 100%;
  font-size: 16px;
  color: ${p => p.theme.gray300};
  mark {
    border-radius: 8px;
    padding: ${space(0.25)} ${space(0.5)} ${space(0.25)} ${space(0.5)};
    background: ${p => p.theme.gray100};
    margin-right: ${space(1)};
  }
  h2 {
    color: ${p => p.theme.gray500};
  }
  p {
    margin-bottom: ${space(1)};
  }
  .encrypt-help {
    color: ${p => p.theme.gray500};
  }
`;

const StartRelocationButton = styled(Button)`
  margin-left: auto;
`;

const FinishedWell = styled(Well)`
  display: flex;
  align-items: center;
  text-align: left;
  div {
    margin-left: ${space(2)};
    line-height: 1;
  }
  a {
    color: ${p => p.theme.translucentGray200};
    font-size: 14px;
  }
  a:hover {
    color: ${p => p.theme.gray300};
  }
`;

const UploadWell = styled(Well)<UploadWellProps>`
  margin-top: ${space(2)};
  height: 140px;
  border-style: ${props => (props.draggedOver ? 'solid' : 'dashed')};
  border-width: medium;
  align-items: center;
  .file-icon,
  .upload-icon {
    color: ${p => p.theme.gray500};
  }
  background: ${props =>
    props.draggedOver ? p => p.theme.purple100 : p => p.theme.surface400};
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
