"""OpenId storage that saves to django models"""
import time

from openid.store.interface import OpenIDStore
from openid.store.nonce import SKEW

from social_auth.models import UserSocialAuth


class DjangoOpenIDStore(OpenIDStore):
    """Storage class"""
    def __init__(self):
        """Init method"""
        super(DjangoOpenIDStore, self).__init__()
        self.max_nonce_age = 6 * 60 * 60  # Six hours

    def storeAssociation(self, server_url, association):
        """Store new assocition if doesn't exist"""
        UserSocialAuth.store_association(server_url, association)

    def removeAssociation(self, server_url, handle):
        return UserSocialAuth.remove_association(server_url, handle)

    def getAssociation(self, server_url, handle=None):
        """Return stored assocition"""
        oid_associations = UserSocialAuth.get_oid_associations(server_url,
                                                               handle)
        associations = [association
                        for assoc_id, association in oid_associations
                        if association.getExpiresIn() > 0]
        expired = [assoc_id for assoc_id, association in oid_associations
                   if association.getExpiresIn() == 0]

        if expired:  # clear expired associations
            UserSocialAuth.delete_associations(expired)

        if associations:  # return most recet association
            return associations[0]

    def useNonce(self, server_url, timestamp, salt):
        """Generate one use number and return *if* it was created"""
        if abs(timestamp - time.time()) > SKEW:
            return False
        return UserSocialAuth.use_nonce(server_url, timestamp, salt)
