import omit from 'lodash/omit';

import AnnotatedText from 'app/components/events/meta/annotatedText';
import {getMeta} from 'app/components/events/meta/metaProxy';
import Highlight from 'app/components/highlight';
import {BreadcrumbTypeDefault} from 'app/types/breadcrumbs';
import {defined} from 'app/utils';

import Summary from './summary';

type Props = {
  searchTerm: string;
  breadcrumb: BreadcrumbTypeDefault;
  linkedEvent?: React.ReactElement;
};

function Exception({breadcrumb, searchTerm, linkedEvent}: Props) {
  const {data, message} = breadcrumb;
  const dataValue = data?.value;

  return (
    <Summary kvData={omit(data, ['type', 'value'])}>
      {linkedEvent}
      {data?.type && (
        <AnnotatedText
          value={
            <strong>
              <Highlight text={searchTerm}>{`${data.type}: `}</Highlight>
            </strong>
          }
          meta={getMeta(data, 'type')}
        />
      )}
      {defined(dataValue) && (
        <AnnotatedText
          value={
            <Highlight text={searchTerm}>
              {breadcrumb?.message ? `${dataValue}. ` : dataValue}
            </Highlight>
          }
          meta={getMeta(data, 'value')}
        />
      )}
      {message && (
        <AnnotatedText
          value={<Highlight text={searchTerm}>{message}</Highlight>}
          meta={getMeta(breadcrumb, 'message')}
        />
      )}
    </Summary>
  );
}

export default Exception;
