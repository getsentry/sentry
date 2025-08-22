import base64
import json
import random

import requests
from Crypto.Cipher import DES3
from Crypto.Util.Padding import pad, unpad

ENCRYP_PREFIX = "Encrypt"
DEFAULT_KEY = "disconf-crypt-key"
ENCRYPT_ALGORITHM = "DESede"
DEFAULT_CIPHER_ALGORITHM = "DESede/ECB/PKCS5Padding"
ALGORITHM_ENCODING = "UTF-8"
APOLLO_CONFIG_KEY_PATH = "configs/encryptKey"


class ApolloCipher:
    def __init__(self, apollo_config_server_url):
        self.__keys = self.__init_keys(apollo_config_server_url + "/services/config")
        self.mode = DES3.MODE_ECB
        self.aes = DES3.new(self.__keys, self.mode)

    @staticmethod
    def __init_keys(apollo_config_server_url):
        print(
            "###### ApolloCipher.__init_keys ###### apollo_config_server_url="
            + apollo_config_server_url
        )
        apollo_config_server_response = requests.get(apollo_config_server_url)
        print(
            "###### ApolloCipher.__init_keys ###### apollo_config_server_response=",
            apollo_config_server_response,
        )
        print(
            "###### ApolloCipher.__init_keys ###### apollo_config_server_response.text=",
            apollo_config_server_response.text,
        )
        apollo_config_server_list = json.loads(apollo_config_server_response.text)
        print(
            "###### ApolloCipher.__init_keys ###### apollo_config_server_list=",
            apollo_config_server_list,
        )
        random_range = list(range(0, len(apollo_config_server_list)))
        try_flag = True
        key_string = ""
        print(
            "###### ApolloCipher.__init_keys ###### start generate keys, try times:",
            len(random_range),
        )
        while len(random_range) > 0 and try_flag is True:
            random_select_one = random.choice(random_range)
            print("###### ApolloCipher.__init_keys ###### random_select_one=", random_select_one)
            random_range.remove(random_select_one)
            selected_apollo_config_server = apollo_config_server_list[random_select_one].get(
                "homepageUrl"
            )
            print(
                "###### ApolloCipher.__init_keys ###### selected_apollo_config_server==",
                selected_apollo_config_server,
            )
            key_url = selected_apollo_config_server + APOLLO_CONFIG_KEY_PATH
            print("###### ApolloCipher.__init_keys ###### key_url=", key_url)
            try:
                key_string_response = requests.get(key_url)
                print(
                    "###### ApolloCipher.__init_keys ###### key_string_response=",
                    key_string_response,
                )
                if key_string_response.status_code == 200:
                    key_string = key_string_response.text
                    try_flag = False
                else:
                    raise RuntimeError(
                        "###### ApolloCipher.__init_keys ###### key_string_response ERROR, key_string_response={}".format(
                            key_string_response
                        )
                    )
            except Exception as e:
                print("###### ApolloCipher.__init_keys ###### Exception=", e)
        # print("###### ApolloCipher.__init_keys ###### key_string=", key_string)
        if key_string and key_string.strip():
            key = key_string.strip()
            keys = bytearray(
                base64.urlsafe_b64decode(bytes(key + "=" * (4 - len(key) % 4), ALGORITHM_ENCODING))
            )
        else:
            # keys = bytearray(DEFAULT_KEY, ALGORITHM_ENCODING)
            raise ValueError("###### ApolloCipher.__init_keys ###### ERROR, key_string is empty!")
        while len(keys) < 24:
            keys.append(0)
        print("###### ApolloCipher.__init_keys ###### generate keys SUCCESS")
        return keys

    def encrypt(self, plainText):
        # print("###### ApolloCipher.encrypt ###### plainText==",plainText)
        plainBytes = bytearray(plainText.encode(ALGORITHM_ENCODING))
        encrypt_bytes = self.aes.encrypt(pad(plainBytes, 8))
        encrypt_bytes_string = "Encrypt" + str(
            base64.b64encode(encrypt_bytes), encoding=ALGORITHM_ENCODING
        )
        # print("###### ApolloCipher.encrypt ###### encrypt_bytes_string==",encrypt_bytes_string)
        return encrypt_bytes_string

    def decrypt(self, enc):
        print("###### ApolloCipher.decrypt ###### enc==", enc)
        encrypted_text = enc.replace("Encrypt", "")
        missing_padding = len(encrypted_text) % 4
        if missing_padding != 0:
            encrypted_text += "=" * (4 - missing_padding)
            print(
                "###### missing padding={}, add missing padding={}".format(
                    missing_padding, encrypted_text
                )
            )
        decode_enc_bytes = base64.b64decode(encrypted_text)
        decrypt_bytes_string = unpad(self.aes.decrypt(decode_enc_bytes), 8).decode()
        print("###### ApolloCipher.decrypt ###### decrypt_bytes_string==", decrypt_bytes_string)
        return decrypt_bytes_string
