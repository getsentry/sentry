import {Fragment, useRef, useState} from 'react';
import {IconUpload} from '@sentry/icons/upload';

import {Button} from '@sentry/scraps/button';
import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/quicktime,video/webm,video/ogg';

/**
 * Matches the URL the comment attachment endpoint returns, so notes can render
 * those links as an inline video player.
 */
export const COMMENT_ATTACHMENT_URL_PATTERN =
  /^\/api\/0\/organizations\/[^/]+\/issues\/[^/]+\/comment-attachments\/\d+\/$/;

export interface CommentAttachment {
  contentType: string;
  id: string;
  name: string;
  size: number;
  url: string;
}

/**
 * Markdown link to an uploaded attachment, with the characters that would end
 * the link text escaped.
 */
export function commentAttachmentMarkdown(attachment: CommentAttachment): string {
  const label = attachment.name.replace(/([\\[\]])/g, '\\$1');
  return `[${label}](${attachment.url})`;
}

function uploadErrorMessage(error: unknown): string {
  const detail =
    error instanceof RequestError && typeof error.responseJSON?.detail === 'string'
      ? error.responseJSON.detail
      : null;
  if (detail) {
    return detail;
  }
  if (error instanceof RequestError && error.status === 413) {
    return t('This video is too large to upload.');
  }
  return t('Unable to upload video');
}

interface CommentAttachmentButtonProps {
  issueId: string;
  onUploaded: (attachment: CommentAttachment) => void;
}

export function CommentAttachmentButton({
  issueId,
  onUploaded,
}: CommentAttachmentButtonProps) {
  const organization = useOrganization();
  const api = useApi();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!organization.features.includes('issue-comment-attachments')) {
    return null;
  }

  async function handleSelectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so selecting the same file again still fires a change.
    event.target.value = '';
    if (!file) {
      return;
    }

    const data = new FormData();
    data.set('file', file);
    setIsUploading(true);
    try {
      const attachment: CommentAttachment = await api.requestPromise(
        `/organizations/${organization.slug}/issues/${issueId}/comment-attachments/`,
        {method: 'POST', data}
      );
      setIsUploading(false);
      onUploaded(attachment);
    } catch (error) {
      setIsUploading(false);
      toast.error(uploadErrorMessage(error));
    }
  }

  return (
    <Fragment>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_VIDEO_TYPES}
        aria-label={t('Video file')}
        style={{display: 'none'}}
        onChange={handleSelectFile}
      />
      <Button
        size="xs"
        icon={<IconUpload />}
        busy={isUploading}
        disabled={isUploading}
        aria-label={t('Attach video')}
        tooltipProps={{title: t('Attach video')}}
        onClick={() => fileInputRef.current?.click()}
      />
    </Fragment>
  );
}
