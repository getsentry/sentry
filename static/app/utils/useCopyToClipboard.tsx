import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';

type CopyCallback = (
  text: string,
  /**
   * Optional options to customize the copy operation.
   * @default {successMessage: t('Copied to clipboard'), errorMessage: t('Error copying to clipboard')}
   * Pass `null` to disable any toast messages.
   */
  options?: {errorMessage?: React.ReactNode; successMessage?: React.ReactNode} | null
) => Promise<string>;

export function copyToClipboard(
  text: string,
  /**
   * Optional options to customize the copy operation.
   * @default {successMessage: t('Copied to clipboard'), errorMessage: t('Error copying to clipboard')}
   * Pass `null` to disable any toast messages.
   */
  options?: {errorMessage?: React.ReactNode; successMessage?: React.ReactNode} | null
) {
  const successMessage =
    options === null ? undefined : (options?.successMessage ?? t('Copied to clipboard'));
  const errorMessage =
    options === null
      ? undefined
      : (options?.errorMessage ?? t('Error copying to clipboard'));

  const promise = writeTextToClipboard(text)
    .then(() => {
      if (successMessage) {
        addSuccessMessage(successMessage);
      }
      return text;
    })
    .catch(error => {
      if (errorMessage) {
        addErrorMessage(errorMessage);
      }
      throw error;
    });

  return promise;
}

function writeTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text).catch(() => copyUsingExecCommand(text));
  }

  return copyUsingExecCommand(text);
}

function copyUsingExecCommand(text: string): Promise<void> {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    if (!document.execCommand('copy')) {
      return Promise.reject(new Error('Unable to copy to clipboard'));
    }
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  } finally {
    textArea.remove();
  }
}

export function useCopyToClipboard(): {copy: CopyCallback} {
  return {
    copy: copyToClipboard,
  };
}
