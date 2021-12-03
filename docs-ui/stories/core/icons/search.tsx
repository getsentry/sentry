import styled from '@emotion/styled';
import Input from 'app/components/forms/input';

type Group = 'action' | 'navigation' | 'chart' | 'layout' | 'file' | 'media';

type AdditionalProps = 'direction' | 'isCircled';
type IconMeta = {
  id: string;
  groups: Group[];
  keywords: string[];
  additionalProps?: AdditionalProps[];
};

const specialProps = {
  isCircled: ['chevron'],
  direction: ['chevron'],
};

const iconMeta: IconMeta[] = [
  {id: 'add', groups: ['action'], keywords: ['plus']},
  {id: 'subtract', groups: ['action'], keywords: ['minus']},
  {
    id: 'checkmark',
    groups: ['action'],
    keywords: ['done', 'finish', 'success', 'confirm', 'resolve'],
  },
  {id: 'close', groups: ['action'], keywords: ['cross', 'deny', 'terminate']},
  {
    id: 'chevron',
    groups: ['action', 'navigation'],
    keywords: ['expand', 'collapse'],
    additionalProps: ['isCircled', 'direction'],
  },
];

const SearchPanel = () => {
  return <Input />;
};
