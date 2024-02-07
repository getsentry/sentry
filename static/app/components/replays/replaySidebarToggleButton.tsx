import {Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export function ReplaySidebarToggleButton({isOpen, setIsOpen}: Props) {
  return (
    <Button
      size="sm"
      onClick={() => setIsOpen(!isOpen)}
      icon={<IconChevron direction={isOpen ? 'right' : 'left'} />}
    >
      {isOpen ? t('Collapse Sidebar') : t('Open Sidebar')}
    </Button>
  );
}
