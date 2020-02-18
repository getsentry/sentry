import React from 'react';

import {t} from 'app/locale';

import generateClassName from './generateClassName';

// class DeviceSummary extends React.Component {
//   static propTypes = {
//     data: PropTypes.object.isRequired,
//   };

//   render() {
//     const data = this.props.data;

//     if (objectIsEmpty(data)) {
//       return <NoSummary title={t('Unknown Device')} />;
//     }

//     // TODO(dcramer): we need a better way to parse it
//     const className = data.model && generateClassName(data.model);

//     let subTitle = <p />;

//     if (data.arch) {
//       subTitle = (
//         <p>
//           <strong>{t('Arch:')}</strong> {data.arch}
//         </p>
//       );
//     } else if (data.model_id) {
//       subTitle = (
//         <p>
//           <strong>{t('Model:')}</strong> {data.model_id}
//         </p>
//       );
//     }

//     return (
//       <div className={`context-item ${className}`}>
//         <span className="context-item-icon" />
//         <h3>
//           {data.model ? <DeviceName>{data.model}</DeviceName> : t('Unknown Device')}
//         </h3>
//         {subTitle}
//       </div>
//     );
//   }
// }

type Props = {
  data: {};
};

const ContextSummaryDevice = ({data}: Props) => {
  console.log('ContextSummaryDevice', data);
  return null;
};

export default ContextSummaryDevice;
