import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';

interface Props {
  href: string;
  name: string;
  createdBy?: string | null;
}

export default function AutomationTitleCell({name, href, createdBy}: Props) {
  return <TitleCell name={name} link={href} createdBy={createdBy} />;
}
