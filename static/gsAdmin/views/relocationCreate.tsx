import {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Input} from 'sentry/components/core/input';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';
import useApi from 'sentry/utils/useApi';

import PageHeader from 'admin/components/pageHeader';

const FILE_MAX_SIZE = 200e6; // 200 MB limit for file upload

const PROMO_CODE_ERROR_MSG =
  'That promotional code has already been claimed, does not have enough remaining uses, is no longer valid, or never existed.';

function RelocationForm() {
  // Use our own api client to initialize, since we need to be careful with the headers when using multipart/form-data
  const api = useApi({
    api: new Client({headers: {Accept: 'application/json; charset=utf-8'}}),
  });
  const promoCodeApi = useApi({
    api: new Client({baseUrl: ''}),
  });
  const regions = ConfigStore.get('regions');
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [region, setRegion] = useState(regions[0]!);

  const handleSubmit = async (event: any) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    if (!formData.get('owner') || !formData.get('orgs') || !file) {
      addErrorMessage('Requires relocation file, organization slug(s), and owner.');
      return;
    }
    try {
      // Verify that the promo code exists, has remaining claims, etc.
      const promoCode = formData.get('promo_code');
      if (typeof promoCode === 'string' && promoCode) {
        await promoCodeApi
          .requestPromise(`/promocodes-external/${promoCode}`, {
            method: 'GET',
            host: region.url,
          })
          .catch(error => {
            if (error.status === 403) {
              addErrorMessage(PROMO_CODE_ERROR_MSG);

              // Ensure that the wrapping `catch` block doesn't try to re-print this error message.
              // eslint-disable-next-line unicorn/error-message
              throw new Error();
            }
          });
      }

      // Start the relocation.
      const response = await api.requestPromise(`/relocations/`, {
        method: 'POST',
        host: region.url,
        data: formData,
      });

      addSuccessMessage('The relocation job has started!');
      browserHistory.push(`/_admin/relocations/${region.name}/${response.uuid}/`);
    } catch (error: any) {
      if (error.responseJSON) {
        addErrorMessage(error.responseJSON.detail);
      }
    }
  };

  const handleFileChange = (event: any) => {
    const newFile = event.target.files?.[0];

    // No file selected (e.g. user clicked "cancel")
    if (!newFile) {
      return;
    }

    if (!/.*.tar/.test(newFile.name)) {
      addErrorMessage('That is not a supported file type.');
      return;
    }

    if (newFile.size > FILE_MAX_SIZE) {
      addErrorMessage('Please upload a file less than 200 MB.');
      return;
    }

    setFile(newFile);
  };

  const onFileUploadButtonClick = () => {
    inputFileRef.current?.click();
  };

  return (
    <Fragment>
      <form onSubmit={handleSubmit}>
        <p>Trigger a relocation job from self-hosted to SaaS.</p>
        <p>Limitations:</p>
        <ul>
          <li>This API has a ratelimit of 1 request per org per day</li>
          <li>Owner must be a single username</li>
          <li>Orgs can be entered as a comma separated list of slugs</li>
          <li>Uploaded files have a maximum size of 200 MB</li>
          <li>Files must be tar archives (.tar) </li>
        </ul>
        <CompactSelect
          trigger={triggerProps => (
            <SelectTrigger.Button {...triggerProps} prefix="Region" />
          )}
          value={region.url}
          options={regions.map((r: any) => ({
            label: r.name,
            value: r.url,
          }))}
          onChange={opt => {
            const reg = ConfigStore.get('regions').find((r: any) => r.url === opt.value);
            if (reg === undefined) {
              return;
            }
            setRegion(reg);
          }}
        />
        <UploadWell>
          <UploadInput
            name="file"
            type="file"
            aria-label="file-upload"
            accept=".tar"
            ref={inputFileRef}
            onChange={e => handleFileChange(e)}
            hidden
          />
          {file ? (
            <b>{file.name} ✓</b>
          ) : (
            <Button size="xs" onClick={onFileUploadButtonClick}>
              Upload relocation file data
            </Button>
          )}
        </UploadWell>
        <InputLabel>Owner</InputLabel>
        <Input
          type="text"
          name="owner"
          aria-label="owner-input"
          minLength={1}
          placeholder=""
        />
        <InputLabel>List of Organization Slugs</InputLabel>
        <Input type="text" name="orgs" aria-label="orgs-input" minLength={1} />
        <InputLabel>Promo Code (Optional)</InputLabel>
        <Input
          type="text"
          name="promo_code"
          aria-label="promo-code-input"
          placeholder=""
        />
        <SubmitButton priority="primary" type="submit">
          Submit
        </SubmitButton>
      </form>
    </Fragment>
  );
}

const UploadWell = styled('div')`
  margin-top: ${space(2)};
  margin-bottom: ${space(3)};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
  padding: ${space(2)} ${space(3)};
  border-radius: 3px;
  text-align: center;
`;

const UploadInput = styled('input')`
  position: absolute;
  opacity: 0;
`;

const InputLabel = styled('label')`
  display: block;
  margin-top: ${space(2)};
`;

const SubmitButton = styled(Button)`
  margin-top: ${space(2)};
`;

function RelocationCreate() {
  return (
    <div>
      <PageHeader title="Relocation" />
      <h3>Kick off Relocation Job</h3>
      <RelocationForm />
    </div>
  );
}

export default RelocationCreate;
