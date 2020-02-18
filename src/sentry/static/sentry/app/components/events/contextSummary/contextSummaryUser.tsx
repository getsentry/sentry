import React from 'react';

import {EventUser} from 'app/types';
import {removeFilterMaskedEntries} from 'app/components/events/interfaces/utils';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import {getMeta} from 'app/components/events/meta/metaProxy';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import {t} from 'app/locale';

type Props = {
  data: EventUser;
};

type UserTitle = {
  value: string;
  meta?: Meta;
};

const ContextSummaryUser = ({data}: Props) => {
  const user = removeFilterMaskedEntries(data);

  if (Object.keys(user).length === 0) {
    return <ContextSummaryNoSummary title={t('Unknown User')} />;
  }

  const getUserTitle = (): UserTitle | undefined => {
    if (user.email) {
      return {
        value: user.email,
        meta: getMeta(data, 'email'),
      };
    }

    if (user.ip_address) {
      return {
        value: user.ip_address,
        meta: getMeta(data, 'ip_address'),
      };
    }

    if (user.id) {
      return {
        value: user.id,
        meta: getMeta(data, 'id'),
      };
    }

    if (user.username) {
      return {
        value: user.username,
        meta: getMeta(data, 'username'),
      };
    }
  };

  return (
    <div className="context-item user">
      Oi
      {/* {userTitle ? (
        <UserAvatar
          user={user}
          size={48}
          className="context-item-icon"
          gravatar={false}
        />
      ) : (
        <span className="context-item-icon" />
      )}
      <h3 data-test-id="user-title">{userTitle}</h3>
      {user.id && user.id !== userTitle ? (
        <p>
          <strong>{t('ID:')}</strong> {user.id}
        </p>
      ) : (
        user.username &&
        user.username !== userTitle && (
          <p>
            <strong>{t('Username:')}</strong> {user.username}
          </p>
        )
      )} */}
    </div>
  );
};

export default ContextSummaryUser;

// export class UserSummary extends React.Component {
//   static propTypes = {
//     data: PropTypes.object.isRequired,
//   };

//   render() {
//     const user = removeFilterMaskedEntries(this.props.data);

//     if (objectIsEmpty(user)) {
//       return <NoSummary title={t('Unknown User')} />;
//     }

//     const userTitle = user.email
//       ? user.email
//       : user.ip_address || user.id || user.username;

//     if (!userTitle) {
//       return <NoSummary title={t('Unknown User')} />;
//     }

//     return (
//       <div className="context-item user">
//         {userTitle ? (
//           <UserAvatar
//             user={user}
//             size={48}
//             className="context-item-icon"
//             gravatar={false}
//           />
//         ) : (
//           <span className="context-item-icon" />
//         )}
//         <h3 data-test-id="user-title">{userTitle}</h3>
//         {user.id && user.id !== userTitle ? (
//           <p>
//             <strong>{t('ID:')}</strong> {user.id}
//           </p>
//         ) : (
//           user.username &&
//           user.username !== userTitle && (
//             <p>
//               <strong>{t('Username:')}</strong> {user.username}
//             </p>
//           )
//         )}
//       </div>
//     );
//   }
// }
