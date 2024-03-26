import base64
import zlib

import click

from sentry.runner.decorators import configuration


@click.command()
@click.option(
    "--partial",
    is_flag=True,
    default=False,
    help="Ignore RPC methods that produce errors.",
)
@click.option(
    "--diagnose",
    is_flag=True,
    default=False,
    help="List RPC methods that produce errors and suppress all other output.",
)
@click.option(
    "--canned",
    is_flag=True,
    default=False,
    help="Produce canned output without interacting with Sentry code.",
)
@configuration
def rpcschema(canned: bool, diagnose: bool, partial: bool) -> None:
    if canned:
        output = zlib.decompress(base64.b64decode(_CANNED_OUTPUT)).decode()
        print(output)  # noqa
        return

    # from openapi_pydantic import OpenAPI
    # from openapi_pydantic.util import PydanticSchema, construct_open_api_with_schema_class
    #
    # from sentry.services.hybrid_cloud.rpc import (
    #     RpcMethodSignature,
    #     list_all_service_method_signatures,
    # )
    #
    # @dataclass
    # class RpcSchemaEntry:
    #     sig: RpcMethodSignature
    #
    #     @property
    #     def api_path(self) -> str:
    #         return reverse(
    #             "sentry-api-0-rpc-service", args=(self.sig.service_key, self.sig.method_name)
    #         )
    #
    #     def build_api_entry(self) -> dict[str, Any]:
    #         param_schema, return_schema = self.sig.dump_schemas()
    #         return {
    #             "post": {
    #                 "description": "Execute an RPC",
    #                 "requestBody": {
    #                     "content": {
    #                         "application/json": {
    #                             "schema": PydanticSchema(schema_class=param_schema)
    #                         }
    #                     },
    #                 },
    #                 "responses": {
    #                     "200": {
    #                         "description": "Success",
    #                         "content": {
    #                             "application/json": {
    #                                 "schema": PydanticSchema(schema_class=return_schema)
    #                             }
    #                         },
    #                     }
    #                 },
    #             }
    #         }
    #
    # def create_spec(signatures: Iterable[RpcMethodSignature]) -> dict[str, Any]:
    #     entries = [RpcSchemaEntry(sig) for sig in signatures]
    #     path_dict = {entry.api_path: entry.build_api_entry() for entry in entries}
    #
    #     spec = OpenAPI.parse_obj(
    #         dict(
    #             info=dict(
    #                 title="Sentry Internal RPC APIs",
    #                 version="0.0.1",
    #             ),
    #             servers=[dict(url="https://sentry.io/")],  # TODO: Generify with setting value
    #             paths=path_dict,
    #         )
    #     )
    #     spec = construct_open_api_with_schema_class(spec)
    #     return spec.dict(by_alias=True, exclude_none=True)
    #
    # def create_partial_spec(
    #     signatures: Iterable[RpcMethodSignature],
    # ) -> tuple[dict[str, Any], list[str]]:
    #     stable_signatures: list[RpcMethodSignature] = []
    #     error_reports: list[str] = []
    #     for sig in signatures:
    #         try:
    #             create_spec([sig])
    #         except Exception as e:
    #             last_line = str(e).split("\n")[-1].strip()
    #             error_reports.append(f"{sig!s}: {last_line}")
    #             if not diagnose:
    #                 traceback.print_exc()
    #         else:
    #             stable_signatures.append(sig)
    #
    #     return create_spec(stable_signatures), error_reports
    #
    # all_signatures = list_all_service_method_signatures()
    #
    # if diagnose or partial:
    #     spec, error_reports = create_partial_spec(all_signatures)
    #     if diagnose:
    #         print(f"Error count: {len(error_reports)}")  # noqa
    #         for bad_sig in error_reports:
    #             print("- " + bad_sig)  # noqa
    # else:
    #     spec = create_spec(all_signatures)
    #
    # if not diagnose:
    #     json.dump(spec, sys.stdout)


_CANNED_OUTPUT = (
    "eJztXW1z3bZy/isctTNtp7q2kvZTvqm2kqixE1Wycz/ceFjqEJIY8ZDnEjyyTzP678UbSYB4J0Ed0DeZTBxLALi7z2KxWCwWf5zUO1Blu+Lku5P/ePXNq7OT"
    "05OiuqtPvvvjpC3aEqCf34CqbQ7JZdWCpsrK5PrqTXJ+dQlR0yfQwKKuUKOzV2evvjl5Pj2BoME/Pfnub3+c7JsS/eqhbXfwu9evIRnnVVG/Pnn+dHqyy9oH"
    "iL/zGn3+9dnrgo3/utltyF/um6xFg7/O8jytm/usKv6P/gB32tWwxX/mAG6aYtdSKi6+gM2+BUlWYSoRgQ34+x7A9r/q/IBbb2o0bkU6ZrtdWWzogL9D3PuP"
    "E7h5ANsM/98/N+AOjfdPrzf1dldXqA98TX8LX18OtN0gZosNSNMxjWl6lTXZFiCW3tc5KE+en58pNUUD8pPv7rISAvITiIaHgAji27MzmaWb/WYDIBb2CxJ/"
    "Ddp9U/WUY9pzsGsA+uRAPfqhDbp70Kb83yNEbkTiqoCTaF8ItxR8oQ3TXVP/DjbtGoAc07xqZGVmXgpquEas4VcFNlwO7SJH1BXtISXMfVnFxB7TvGqsZWYW"
    "gnoN83jV0zbwLBUcshX4UDp6VwepnpGXgDfaaaol+KsBOOAE3mX3YGTmowRWReeq8FQzEBRGvbrEDKqR6vVBbGEnFOAQVDkafkO8sjQrQdOmVd0Wdx07EcJt"
    "o3lVYNuZCQr1FrGD1CtaWBl964OwJzwsXLAF2RaucoY60L5CmF2YCqUC+12OesS+F5KpXBWsKvKXAzBK/0lB5sohDOghscHXFJ2wkLxGbJePUVg+FPPE/Toi"
    "FXZmZkEN4R6QQBR8yBDz6V3d4G8dHVZMlxCtEemLF0Ir4cHhasB9DBbXxDglcZ2gdbTPwa07Lt80AE/m7vCW6UQ0GS1XlK5eEhZyo8XTm48Q2GK1uT2kRR4b"
    "ij1hq8GLozgUMtusOuAxedyP7ryo+FYSuirkNByEQrLexWgqB8pWhVVHcjBwGpuxjRI4K9XrAtWBnRCAQ9AUWVn8HyBTPjZgRepWA+CY7BBAdXvIKC2nQNxq"
    "YBpRPQcltsEQ5idC7qnAKfVFdd/tGkYhgEj2fdeEil842q442q93m7EXrmYjWuCD8beoiqiiRLDc36d3Tb1FJODbGFEsv+7idGbpK1AdD17nqNEejdNZE+Sg"
    "479WSHBpVuUporgoj60dHxFF4/mkJDRazD04mI0k2yZ3Y0cF3oi2deAlER0EIvClgC2a8P24R487SEzLJK4HMBXtQXC7KxrYpnC/Aw35WWygjehbD2IS4UHg"
    "imEPKrEa9dZTQ20wNLAtjc+tkKhbGT4D2eGAiiCDWc1szEnKBorDIAO2t6A/f4zTcVDQuCK8VMQHgS6qUyaJ73UcLdnIDgIU8T8ytLfO4vPvONrWA5JAdDiI"
    "ovUkBOpWBlNgT6IbE9abIivTbN8+RAsXR+P6QBOInw1dXKd4AtMrOcIz0jwbHxYbji4EwdG1DmQEgmfD8oRwvjukGOP4VqYxcesASKY6FEoEczJmXN64TN6q"
    "kBLonosVXdWI1xBVOI+QdY7IWllgz0R3YKzQ53HSUYX+jBgyjso1IieQHxDAsqge43HWZd57+tYGGkd4QLgQHYjBh7StH8HRszk0nAs0rg22EfFBoXtCY0aO"
    "3EDi+oDjaZ+DGx9pZEHiLSKXJlpBfLO9++uRUeRzi94TQt9TwrhND09vtJD6MzLrGh0rtkdr49G/FMc/XblkZAnL/kBetOBZ6Q6N1dE3BiaO490WWKgOhhLJ"
    "TM2PH65S8tsRty6UBqqDoUQ279wsvT0MX2kPu6Pv5JRysBG9LlTt3ARBmwU+0X+y6EDlaFsPdgLRcyDC5DV1SQoDCPn8CDtEBiZ9+HlU1+jeUMpdktutvEQL"
    "fFgmF1GU1WvH16sSL6oHuhskK9IE7SWYr0AX9LwFuBa2yTYP5J5gCbImfQRH3x7Ri09vKFm9DHryogXUSvccsB7q+rG7fAXZ2ORnRwbrR0TDwKtMX7Ro2Qmf"
    "DRebtp/BLRmQXN56IkTEBJqWynVAZyB/DoB88VFIdrxCOVI0SLErYsDyZ55QYX+oIThaWCdwEhbhXda0BRo8ixpWnsoVYimSHxZAcmJGypV8BuCxPCBd2dVN"
    "zGDqKF4hsHpW5oDcZ4mQo/BYYsNSeoVAXbTg2cgOD1T6uUB/Q8TfFUffTFq45yhdK4ACC0HAxJEC8o1IIRzRtx7gJMKDwYWvEBJFgJtiGyVgAoXrgmxEeijQ"
    "hrAOaoiDBUd3WVTcy1SuCjwV+eEBjCCAZmY+5hCaA+WzENvtuhha93Oh7j12XjcPWVWBMmXAHB3L3W4cpXIlPV6U5/A0F/+7osrpAzPZbdmH/I5vbzmZaEhc"
    "BZ5a2sPgttulHAHRYSaQtyK8RnQHwaqoYJuVJZ3KNDflyyGKi4gS/3pS14OhiYcgeAqHIxAR0xyw4kQHpobO9SCpZWAujNih2uxhW2/ZC2vNHpnobEMDqBHh"
    "aCR0FUBaOAiBJD/hYwNPMEZrwUskOjREcbzuYeQ57mc+XEgPDloUt62MnMd92cqF9ICgDS9lRZPMqJGAgtK1gahkIQSYMVzeH/Mc9Y19NbEhoNjtb8sCPoCc"
    "c0Rh9HPMjerVwOnKTgjAG1Di1vy+I86Ai5XY1cBr4SIEqtzQUbqhY/pWg51MeHi4YkjEN/MddZ69C+lzQUNNd1kD4reaRkJXAaGFg7lIwqjqGfKMw3WUMzSR"
    "PBectinu70HDY09DavQYsW6immt2alcBogsbIS6lRXcPiV3QWt9FJDvhc/Aq63t6IFRmsE3x346M07t64FEgLFqADBQHeLCRzB3s6eTgLtuXbcr//MhYsYcQ"
    "fwJiKQMFpdGC58NCSDTjR3HF6L0Eani7Ecermw5C6GldM5IcEwthCtcEKvwqUIWhYMX3k2CBHNhDlxTK/eTIYF73lIwzJQcao8XQjfhA0NEIKvtrBGX4FMyP"
    "SVwTcDLtS+AW43wTCVwtZuFm2hDNiRo3FZlrQk9N/9xCwuyt+WjO13EV3l/IF9dzzG6kORRAcQWgFSyvJA7tQHmoIs+vszwXj+Jp2edjg8eXluqFoKE1Whz9"
    "mAgGKfr65pENCx+KXTRvyCnloaV2XbAa2FgU2OMnRDiLI+LcCC8ewuFZ76vuMVZ6N7vetymEdZyQ6qhdGap6NoIBiwYAo6KHUUKqoHNdYCoZWBLGmN0jPbnr"
    "BzW4k8Sfe0U/T3XErgtXPRdBUS2qpwKpT7y+0ZjI9aEoUr8QejHkjjpIIOoEUmf6g2LIjDXcb7dZw553KPKjH29ohaGhd32oahkJCi+L9sWKJiVvfeB1dIfF"
    "qunOL7uVtwXZ0Uur6WWgJHeFWGr4CIztffTrJEfjGlG8X2iFFNzfuD1VmdRVAinxsBye9ecKv5tJI0zrwFUgeeX4jnhZDGfiXZHjT1y4H27q478c5yQgBd3r"
    "RlzJUFDYYVHdlyBu14mjcX1wCsQHg64B2/oJRFG3Tck5R9+6IBMIDwbXkOMQfUBWTeq6QNTxEBBP9tCnVO4h4kMUG9Frw9jGTTC0u6dB2X63qcs43SEFnevC"
    "VMlAaBgjjvEJFK4SuuCRPtUjixHbWD2564RzSbuabhHR+G45cpNjAvM9JUvw4tcAnpLuJcCKIgfaxnnUadBuxM+rBwDxq24Qfq6bPH3I4IN4aHJs+N6hT18x"
    "8n5E1GnOGGIF0JX8ORAWW/xSWwq+4D/oI15lmd6X9S36E5cSL56KEtyDnD7ydmxELwm5F4RaQRxGqqNFeCo7bog/Yyq7bw5Ekf/ly7zMfVwEq0RT70DTFlR0"
    "gk0vcvyj9rADSApkaNAg+bVFW+Kf8FYqucxPENH89yv0Ia4/bBtkxrjul0Pb5GfcdtSfhDMJUUULtlAeCrVnP8iaJjtohr6hw4wGZ1VwbCzyA72hXRinSIgZ"
    "8oEyrnt9i287c73fd22eB1L7RoMO/02SukKQStloefo0EBFSXRAb17vN+a44H+aNrEM2mWL+2B7u5Lu/fIN1vcRPw4pgSPryhjRKxO4nJ0N3CBB/rcMQN7Sh"
    "OIwCoq6bzPPpyLicJ11MCT+gktARkvYha5NtdkhuQYJfUE3qO2ZjEzqfXzGJ3gBcpQl9IIQw6TFAWVBL7z13yHxJ3uHuqBFnIG1zhZNPoiArE1XGeL9Skjfq"
    "zz2NYSHkCrdM8FUyNlfpuZjNmuFGKsJtduxnOj1FlcQn56ZON/j34077vXkGfNwXsvLTd7MnQX1Bu6IG3UPc+6Y0EfBX2iz52BBbUMDh0SCu221dlyCreC2F"
    "yXnfkGOgW73RQH25XNtAV31D9UD7ynmoj1xT9WCdpbSNdNm144Zpm73IW29Wiwop832DvRE3ZpNr2hN9p++pIBi2WbtXaACndrTFWIdmL2acpRxs2VJG8pIr"
    "Rx/CYM7xeSTjO4ZAHkLG4Ax3BF2hPgfrOMgYu480JopvDiitB1rYtxlGGjf8S1sQa9UR8xb9LHnLOk81QfhlRvIsgKknsujJB9LIVYEEnEMq0yyXiHfgJeV7"
    "yso98AFQ4NHmJtLRQ/l2wk5EFIrrW3Zhtw+eTrJGDs7v8IlGhfWXWWLf0Cv2B/JnEAeAEZvSTobOtF3yAf+eH4SzIq6zrGNcnmD/O27zv8m/ZknFvSWfMIL/"
    "LfncoG+CPNnv0HzLxbn5VGRoYoLfqma3SYh+3mUbIM1Ep0cI9TOu935cp17HuN4/+pWMPWtWur2sqBKEucizJAfc3u6gu8wzNpKRIUsFanFqvelaylRPWm64"
    "mrYWjikJCWN8vFbbZpk0u9iGKB0iRLoJhr94Q1u5zsNBSkstddZXIwNOroGbF5hepmriChF4PBwpSWTOLnTBtVEkS/6WSXw+72h6SjNWX8nv7U0F091CbXuu"
    "UmGmi9QrplIko7iK3XxLXzBJwZUTLymExT0A1k6UjpYtEh15y3bFhj2mHNiWl6wyuwXGyMo70kBabGjJdttCdU6ayd4gCQ9VeNEwh0IuWJtx8MJx5RoEtdTK"
    "5fe0qAQXCZGlXYDDVe0GtuYabxK8JJVQbbsCVkg1IbsDm9pzbMkEjr6pmRyeb7Z6oeLpWYicLuo1+LzzKrNsfCZVYnSqs7qwwyCS5eww2J+JtckrVpfA8pas"
    "hS317bAJsUkbDx7QaG6suXGyGphUd9osLKofXw19FI4Geypy1Mps7mkb/wPifnhXQWmenHWTlZs66NgMZLKtz9BqeXF5tzXGWKbv07N+Alho6y9O9qXXcedn"
    "bU9PlBR+X5RIfufNPVSYa17hilx5yNrpgikZZRgF6QbsokiTB6QeAgzgluLw27Sj44+kp9eBF39QZEn16M+KGJ24n2L22wcRZD+MaNjY2JREMceUqaSSMt2R"
    "MWwTyfp5y3xhXzFMGHXiq46rr8JGKNJlZX4nPj8c67Ix9TXl6YJZSFWWV49JLzXLcvJ719imNxPXhpFGQem8ZOK4wuYUDg0tpyeo3X1T73EBWVPbH3Cb5L8O"
    "mrNMrOqeUwPnV4z4Zv0NiuD5MrW3Cnh50dLKFEjbfR6uljm0vvn84nte+yvULlzEFLF2eKLaxpKy6pAcm3LJUbBGkizhRZdHp93YiRsjRa0kkS2/V5xtmxHz"
    "pBK3HCRHuvuU9TShP7pNOhO+SPR6zI9Eokbyno9he2EQVsO4M/A5qubzdjbNz3/K2qyZYolHOYloMwFsqob2JqC7/JGzHA/9wViX3iAcchFy7YdcpJl8yFWC"
    "tsUFcCjTtjR+2ipwZio+5L/ALx4EkDnoxtHJgX5oLMQCpk+IhbvCnvX8a9dOyiA2y27gMrD4zvftA1IMfGBdh1Bbl+yMLi9DuolCsijzNFMqsjGV9g3tmpyL"
    "Kv7t2dnZX86+Qf9+ODv7jvz77+S/9FwYkjIVkz74DnXGCSbkk7JHLjM9njuU47q6K6hZ7xcA8hPbVBJQW2BGzdQEwtzu0djj6lHqMem2x8RJS7r5xd/2VfH3"
    "PbikzfEh/egbQl753z6x2WBj6mPXRpGAYL8kd74ZrsXlBdyV2cF6+e8tbZcoxTkxWwLZQLhH6rKHwqmL0gje9A3VFz+yQbvtFvVcaKwZsKqrw7YWQqXqwfqG"
    "moE2bfEErKPQVuohkON1d2eVEGmkGIDYLIkKD5PFaGO0CPcejAT1IQgVVf1d9j20XkfqbmYj42m6kdSNCL7sqKNmuavTjXrB2qtu6AAIyZXOutoY58cNbZj8"
    "TBqinrjYTTBTcU0GG1sKNCO2BflssA9dcUOOP5f1bqrtLiBz7agtUxhNS//BcTGcZwwjY9L4tc3rW+KqaDjDEb/g4HoFXWIFi/Whu7ozSlUsy/ozwE+2FfeF"
    "p0r0bNIxkl/YGES2edGmZX2f2m6cneOWybv6PumysGZcCR+ugWO+24NtUbsgrdiq9lhUxqOmn/DvhdjlASICO5V1dUbnH+h5pZZa00oVytppy0LKiAZ7g6sz"
    "fFHcFcCT0jYDFZQyDBzthKscOELHovjwABKmCYTfskzI/h4m8KHelzkWRoZ/VOSnCVoIEsHXSDZ0WCkHEppf8FzqvBHpFEy9BEjNZ7oZcHREjJPpvGNOi6gs"
    "gvU7x1r0dMpE2ogLZJLu7/ELGEOUiGUPs7IQDiHGuwKU6gMia1bm97Qr9pyoIqW2qz1M4RJyxceONxl+NLpGahNEwQIROBn0el8CmlB9DSCx5lLYnFWSMfmD"
    "XbWZZ3y5GsLs3ujtvWdNrLH2voZNN+gnwU9QM7BUVraLnINEVNVszZpZvrSzZUqI/xMz1+XhxZsY4Ef2EJLrkhO/LzNVchRxD9N9VRbVo2VzRLzA5GPXVLUv"
    "2hTb1OWqwg1qmCjuK7gEMGWmFghkXnFpnzEVJvBKRx1HVu46FXDY/YgSFgOMGmy6gGP/WVLa1cjuW+Zg4Z2sxGs3Ci3DhSa21Vx3w/1AeiTnnZm16xc/Cxmn"
    "n7RaF9xtNk3sMKaXp97f4nqQaOcIv1ibUhk7XdT0SL/20VKLEHYD1rI+zODQUz7xo68lV8UpfpCo21Y44b9UOpXfQgyN8rAxRVcVngY8xJteU8P5F1KxLh4p"
    "b0U5PXlAm0actPsIDka7+2MGE5yn+xM4+K7mGrEsamElwMLmPGpYCr/F9OJLJwj8vCKZw8R5s01IS1jFc3RHmqZdQbSbhZByN5Cs4XKY5WyKRVyYZxr5z12d"
    "yZ+o/YjJkRZNmhwKFi3Zid8diVEmw0Ih+InnqwELS1o2ahT4pU25ShHDGnTGyIsYEhs3ViGgLnY74qD9Nm7wEM68qIhy4ySMA8wADAuQRB8aHke+0a73TbZ5"
    "4Ku9b5DD1BwLGm+anPjwyoKXLeXEKeNHFxqdXwd+ISZIEQRzyhZ6dqwG90wq1aJfONUX+oU0HZW5xZ2tyUisZ38krniv1+i000S3pIuZfMDtlXVPWwBb40iX"
    "EPWGQr6cU6CF5SqNU89VkKGRrnAxfrw5gSYoWSS4Hn4/5GKQxBNuRDSj9c1/6H459DAsd0riRurX/x7BpqV/1zXiaXJ9ZIL78I68DOE7mJoNl1CJ8BXt5zUo"
    "qyQzGCFdS5KkzQwA2rEiZvB7APxXvW78NeC+cKh3f02a9aXuse8/fDFr7AFWK+MWcfN0Kr8vm8tlJCjHNbD9uwa4StPkqr7zkyc8UzVcbfo09WgGaYxT42Wq"
    "ONGxSxsWVVDWfGEsnY4URaJEjG+bYAw+FYM4dUaKJ/oVC/DnJ7w/jdckTNwtVoBBV6294VVW9Yic28XFyUo7Z3nIAcRytN6Ce0vbJYP9JwCk4Eu2MbvD17Rl"
    "ckFaOlTjM06QkW0XyJ+mAs6AhdKDVU8YN7YQAT/W9eOwIaWbMcgXrHQp/jw17dP3jsc4HDrzWmrgFAdyTXXyaV93f5VVOAjysorlRRX8korzO0TeivLMKpqS"
    "Jrh3iGD6vSWx7wf1ExEzNHSmjg16Yew5oB9iL+ELeyB1m3jUYI7H8woUMihv1+dAF7IH8r0Nvh+NY6bYGtA9r5RVeUphXrz84KwJN+05qAAK7HnSKLEpkt6T"
    "pMPTHR4PYEPXQeKUN/Q50hSW0DfIPf6iPRhr57kEbDwjLgX7LnKlbY8FdiQiX7odlgGaeGRfB0i7cTf7R/ueio+OYjj6vtr4zZg18ZZG91Ph1IkJrHB5usft"
    "vojq4xatk+9q+NJK3Ziu10RdK3JrBebLfDctFIhUgz26ZNSPC9as21Ba7r+9dXk6lBg9xttAt0gS+5QYt+vFGXJFtyIb1jj2PAS3jF6MWBgPdllr8cmnPNG1"
    "dAjiog1AhgRKPtRVtna/wjF3CfFcBOYtPg5LiJsYRPM754JDT5KejY7zKSbVxVQqTjAkzha3iIGT9CUGwswibZ6+sjVbenoLSV/UGfTePrs8F93pswp82ZT7"
    "HF+qbEk2SMopm/meyAXtmbxnPRNO//zviwyrtciLDRhvUU/HbNXrtR97KiGxPRF2n1wqXbqVFuj3JiM30M/tG74lu3defFj5jm2F1xKHOUHfbtqLL/i/4t2T"
    "smT3wUqsBcVTUSJYcqIj9t2RaS0N88UZtIfOcjfUc5k6OwNwhgU0PGnbj5LlueeJN/8wrjWY3DcdwsKzbhM5XSIaUTh89ZOSNHdZME9u6DrRifO9XDdtf+ya"
    "XOn3ernXkwUuHiV34U/cdLOj2J68/ssj95ODI6jn6aQhYYw7x4K/cfCmU8McfQ5kmDrLWoKXmQMzTwHE7u7sikNJvM+bQSbgbRi6Qh+nWhvJdGSt16PuWHPp"
    "k6RZs2SBbbx8CCStl/xXPSGxildaQzva2fnxxCV1oZnquoZOs04NgHX5hJOKxgZBkYtFmybDa0D7yqP/x75x4rM4m8Tar9Disj0mSkWodgUfK8PSC7pdfUNb"
    "wjGHixhGMxsTZbH8ofvqTOVMWNTb2GkDBY40GRQ2eOxpPsOOYuujPqy4np+L6+Kx8mrJe69KXixH8NxQo3WDP8h3Goo7zVeOw5+TeA3In5oYp5UP2FaYJB+i"
    "o0db/JIb3tdxVYhp0pnCMI5npDdU+U2zyF56pZVBDr3SjjlcxDCZ2XCThdPrNfwnJ8bPxDUzxAOYXq9XdrNnWorbVd+7CyNyInGggwQPOQEMdJXFtmiNfd+R"
    "FkvtMuZZy6k+xJIuw1F8BHeXQIvi4rHvxWrIqELeuqIys8XyLN0/nR8S727PkzJKlh7dzXlcJSJMnG8Wrj4FGr0MJvoMwgZJsqjzFKhLqBufi/gBD5BckQGS"
    "i8oxxcMhQLTpioUp9/M6zXgJF0OvxMEvQy0S3nSjf4IA3Hbvo0VtzkGd7Gwcz3pK3YPVMzyeD4RrBPIWwph4gwsF8tZANi8Oj7SI5oR18HGgJng67uo8bU4s"
    "V4HwKP6QI6d0Bb/K7ouK/Fp9BwFUG9Q6Tzf7BtbGsMcFbZm8oS2fyWM46U4s2y6rBVKl5Ao3Eu/ImfewI6qXXlQwE2Or6JHpiguJzZrruLZniK2aS5EBWbqu"
    "1XopnyrfYVxcYLKMqc5SDcMGFWgV1kFTT8a3B7E1bUhhfHMGIzak16ydRVF5UgNXSh9Q0j2yMD1IQFe1h6I1r2k/FvTG5Db7klobv8++JF2HyuFVk5H0yMIJ"
    "nnx7udqRBd55cNfyIG6pxEuQBcVOsIlT/VLkZEGDRKbUj13ZJ8FN15tz2VJLgUDeYC9ncBVFhzpaPWytHzYzUI5duz3I10gBoo056rkhgeA0w0+tpFXdFnfd"
    "tVr7M/LDGyoWPR+ecBxqTzhMD/rsSx/qYKRad2C0XZcIAT67RFl/Bp+5yOoglrbNNg9b/L+/Qxoj0h97se+e932S/4bUh55pExAITbFJxzUyFc8J4XYJc80R"
    "7zyctneZfuYauz3OJOLPgyqiJYBgEK538M9bhSdPBa/apbLzFXCz5EeriWH2lFTMwePTk81DVlXmotVvWJPnoE9uWQPTA23KV7m8xe4EVWR6qKTLyAjEVWbh"
    "vHVnXtDbS6EGE2UKkw8W31+tBiXivuUk+wminA1NbPrnS7NGAOxm0csdqa3gioPIngUNBwF6iD7OJG4bpc4MHjFtYm16Z90VukjXB5iVpxZYeTLLYnqCgXwE"
    "55XUsr4DaUQBaNPxwGm1L0vjEngD2mQ8WvIz7uUQQRmL2E0bfPIjJg0T/wm1FwvTxBDBOfWf88dv/riuLrPPcu3jfEXHuX7MYolBuAfCaTB8yHDJYqRS5Kk0"
    "eyTSsSQ/GdeSIn6D27ikrrGi+f2YvFh8OaKnYz809X5Hvv+e879EVtknDIV0yJ9hgyG0ve71cQXZQY+krMIMsv4ouPCfDl6k2nhjlb0XqooedC6IRci9p4SG"
    "U1cBrQN/FbXoA+/q4VWquwItgWUG27Ss/d+69Y2ttllDUm9uXaokfyCNk19uuVrJpEyosRep7zrhbFAirfsYJ2x3wT3jh+PyokU9LjqSw0lSeoUcr35Zrsnn"
    "MLpJb/H7Wuf5OM/j27Ozs7+cfYP+/XB29h3599/Jf3sQbDQTtpUP/pIi8NaHIWkZePo8ZN/LpW4X7chV76Jd8cNrTj1/Al25pGKHhdqIL7rLp3A7LD/SKoSG"
    "u5Xq7D/kIhH2mV4khmQPUWlDrqmGuTPfmIpkextRR9oIF7C9yiD8XDf5jxkcv7zYle0OW4DOwk43lsDQJDKpTzjurIgVWq8pjCe9D7/jvg+MBt0EJDQ6v2yg"
    "YjCsnruJPogHIXEyQfX9ycWLGzaVH8iHZGBAtd/ij5Frlqcn5NXGTyMzS/pKcq8S3BfQbVuXwUfaT1HC3va3jFCjCempenZ9cM0WV2YZCrVca7HnaiyBN0ih"
    "GrDDD6Gh1TOrDskWi7xTQfx6d5IlaEUHxX2VoDUtaeuEDEWkxWdU3IC2RVRfEDD+6EHJwa6s8T6cHFzh7AgE/eNdWX8+ITXumxrpCPrfv+9rsqsif/41a/Cb"
    "M7D7+4cHROFDXeb9Ty6apm6G3zdZBWlyRv+z4ciy/9E1oiU79H99X1cF4uQGaVz/s5sdqHL8sDRlCv8c7opHcNXULSAfwJvEAkJE3nuwvQWECCTCuhGr8etE"
    "46CDfFcoTBDh2K8Bm2JXAKcnF4a2PkEWqjP6kMr1MGrfyDyoTirz0yh2gZ/ImTSTrXvIXl6soUZhpqE+TXXcFgbkmBa4Kyk2wVvFmaokVWQ0LKUTI3gzZWKU"
    "Kl6XC9Qv+1pmYehptOTN2onTyYiZB9rzJo7u56ILIEngJaeHnl2jlGiFUxwP+gzAY3lI2eq4eLSHOf0TFZdtB6bkefcfdhKrs3wmSjl00dzF9MuNhWfxxfD3"
    "yGfkn7nHAy2rWJ7q8Ek9lAvdz9Ltfdbr+zJT3gLMGiS1LK93rVD7SFHdHbdMzllLqZr78JTnt3eZcaDuIc9vv89Uw2TIc/6c/l4XFer3BIxDYS/7c/LffVvF"
    "cKB6yKoNyEkB5WxzMPPIGidXrLFiwLyAeIvdBa0LHM023yp7S3skJG6eJ5e0h2FonAmOX828LUpcfOYO7S72jeNHcI7+r33f5PuurwEwtKAXZfoEmn6SOeF3"
    "gbslv/LdFB/BF/I29VOabTZiVFIe+A1tijaHpKnLgwHc7lSr84Fv5ym+M/GsdXxL0T9G5ZSpNv7MhJOw8RAkek/jLBPj929YZzQYVTzL7fRfu0YqFdvDtt6O"
    "o3VyxjJrNqW60V1nPT1yCgQl9FdeSW8/PIAE7m8hILrJrxlJl4mYZE9oThK1vmvqLVJqkGzoo7wJLMo6gTvk8OLpWpaHV07rYvC0pY49by/Ai1QH1rZZ5fD4"
    "1FKlJfxcAugjCCVjzgJZLsmmRz60f+jPmMKUk0gc6/2RZOcodt+1Oa3kuqZZJb4v5OGV1DQuWWrpnbsnJHnr2Je0WX8pEP/N5YIf7edaQ5hI45PejikkGnIt"
    "1n6LS7KC+KbDlv548c0j331LCPIZhPboLjMOjoXPBFNI3H8rqmZjoEk38aZAYJmHZojmyHjsScWX24A9NRdzM/bNvl7b42JnjmxhwntLAnPzVkZvDnSzUxNL"
    "gLBO07KoHi2+/A2sk+Qdbadw58kwSG8QZg7jXLKGioGYfSAFrFJc/wVf/G4txFEOE1LTKsHFYLpOig/gl2Vp2WCIZGMZGL+fSysqs8a6AfGsd6WWDIrNgIVS"
    "rOMVaOBDsXOWxNXQxywI36kaflvOf6PXbOmZHKYPS7sBXbFLnMpqs+BdsUt8V2Fx53HSJpZDzHVFimGtMLs4EkQak+mtS9Ri4vQRKrgpOSBjd2JaLAmmOJnB"
    "Ej+9hDgTo1BHTokdModUiOW5lOtthT4ChBskwmmV1m5oV9wAoWLNO0RtZJfObOA4tJcMNQbTp5CurqetCmCB2MQjV9p9AhEcSnplYYv/BzL4VAeclO4kzza6"
    "BL1J7U7SWhv3jnQ+TTbX6Bf1IzDWCfpAGiiMGs6tYhtDk1W7Ys1UPhYlm+aN2dwrSvh511YxHGHFqcAq4amvrKoYqgT32eaQWoXzjrRL1DJydAd8kk8VZuh4"
    "zttCO6x5Wys/snU8I/o2j6wH8dRvD+xsbmmX1dWH9Ha06MA2qbkzPkF0cSuMI+E+fBf5S6XJuC37U3NhJslOwbyv7NanMGOqtRzX+6rt+qY4M7vetymJt6wg"
    "/WUCGxME4VW8SeY9wAmWL5U6JtHvwPiK+UsYBofZoX3Nym4YrFJzYVveXr0lvfrK0xLP7C7CN6ffnv7H6X/qD734cdzuipC7JiHCBD75DCH3gJPiEzQ33ul2"
    "Y3+4Zo2m8VG0Cakx9m1+6A3+jFdxg6AwKX8oqO54Pa9RZi0+PTNRfNW1sdUHX+AJ2pEp+DPj8s+My3+YjMvFUy0Vx40R51hOCk8aom59RLJ7IddnbPvbvlfd"
    "qBNjtH101sued6cwrodkymhroGQLd02XlHyRvEylW3kNIAICAnkuNOw3JBrruz/lfVbsw5PEITGO5TkijTE/gHyPbOu9pab6DWuY/LAvxkdJli3CiG2bW97L"
    "b/HwpXITEjywMOIqzK7TSroPzy905K76ps8o74fcO+9NqebbU8SsP1T2HuI4NahnkaljE2fwcgf27sEMg02f9yF/SoNP/UDYuFFs4pcdp71M3DngPF8szyZw"
    "sNMqY+osYELpaWX3ILoke09+Zy7/2z5fYUKkvD+lnQA4O7PV4M65F2cWp08Wqew2sHfhyZ9ZgQuOYA8BE1XhFxNHziAhgjkXGUyyZFe3+IH5rEwov6eod068"
    "Q1zH4Dc0XoV7KEYhDg8e5K7eoy7Iz0XD3RdPoEoYzklxlxRtAr4UsIWnaJDk9z1syeD8gL9VwojIxcEtKDl4iAohhtzbzQMbSe/zyJoaxOrJMIQzfXpy3ZjE"
    "W9BwhVe/AutGWPWTvFKGPuJfkZbJBJsYZSoA99tt1iB+qJ7+gxVBmC0deTNN58kN6XgIEXtfc0adb+pPJ7bFt9BGjBe8pChwqVfzkDskZ1ZNsqp3L3LCa3kn"
    "kzyP6T3x8aAuQtLw6CIWxw3xQuiqqDBS3Zcx7HZnJHt5aXDxMQj5kM1lwWceJFfaqaygDLj4IScJuklkilCDOBA0gB9OYRxoNfN6H95BDZn25QG8nhN5bdeu"
    "6vGeFrmvwLq1d/HKEHpAgge2+pU34FTS0GthcjBZjsEtp/Kunv6d69Qsqk25z0HKnw8a0tpJ46Q/9uMUkhVQ7MbrDzKtg9EjyvFIFhQdA2AOaAxhMH6UryEY"
    "Zo9SqTiWbUQB+5q8TbaD2A8XTEVDnt9OigoWOQkEFS1MhkTTPtZVVAmS+hYyX/5fqW+Tlf9GIk9Jkb/6rSJfQ//me4DL/WJrU+KS7km1p0GwuwRbGog8dEg3"
    "CUwrJKpwQCwjI/+LQE1GQlm/VRApQYIPdklLRFuGCYUFbEG1OdCo1qsk4dkn+S44/FYhBUtA9QTKekdCaLd1+8BCYBAgTgAOsGFzmSW4Wm+JvtcOdYKzMvn7"
    "HjQHNDxCIU9uDwnNuThNcqyY26IC7BaeoME0yoc+hVixmlpJ74OFO1RaE9TqGkl3Zrv+XKGp2mXBripR2ZOXqSJZejP8grtgVzZdRUW20cTWoymXkmtvSz0V"
    "5JX6zK7gmdMicAO/N4WcEqSnyGiWvJfTzyNpppVLk7joQvIS+/kFrJmJeGemY9xvawnUcdWAbY3WdaIF/xjXrUwcO0kp7otVWlJ1vHXxbt8rNk7bxAymIe/S"
    "OMDryI6vNI4Xd3WhSM8Ne6eKvUkoncv6Tfm5h7mx2g++PNx0w+It7OmoxW2C/OjXSYE9LctnV79YzSOvVO7pdXucava4yMFLhrEm8VmJtXAZ0cnh6dQlQX2m"
    "eOonQc/jxVGviFJuDZSNmKH2i9YKPW9U99VevGpY2GKRRmZtyM5e+P1niZurIHgHWds2VoTMcvCeXfzKT7/vqpMz1nfTEHGv7K6Uo4+xQxlkDpVZ2l0pKPw4"
    "7NK6OJSdMs3eobbUBD3iPvFJGnKKDJ75i9U/AcVJcA6rdLe/LYuN0VOBVXJFW+mr2xkFysll+rVnrqetDh3Hc8jkLB8sgkxCjg/vyTeVWIHPa7Zcde9PwrZu"
    "cHQ12xXqb/UXEy3VHjTUxT2lh+XbhNtIGLMMwalUWX6C4BzFHavGummqtsstfgnr3smrn3baEYkeiccfc3VILzVvqa9BrzTkOvEKX1LFplWqHNW8fEHtg5PU"
    "zyRSf0zCHrrxmhj6yG0GY4NY+q4sa7LrLUXSXmqBtSl7p529tnsVt/HOI2OFKYVsUmM44jzPSVXyLmLXlz+yFQhxW+a7OdNxpIwWz8V2inqENNyT58I0chXs"
    "4on0MldzHU61vJXFrA163syCiAthDWEaFshLVqi5mI2w0AI8AuSlnj4TV1WJCIss3STkJ95F1tLFFlJfjjSycD0V2A017NwZD3CLqPuudHvIgxkhWPQLafNr"
    "B6fIJfoGyFOaIsufTvyEf45fR8E/R8N9BmWZPlb150rR+K/ol8lP+Jd9D6eQDk/ZAqGdGfel3BDn6Q+i1ZqDDWXT5k+X8Ct2CSdCPENZ4nMffKkemP++KJFI"
    "1Od+lu2355sTBjsn06JAZ0jmmfRsq++UvSPEOIYLRMp9M7dQj337kG6GmyqmbueoLS4ZsvFK25cnHWPQoFkWiTtg5Oc2Le4OmchTcOOZHLGYGzQ5JUJ0kBSp"
    "EH4c20V0nAQID6Kwu0c2F2+yzQP/COIGkdK4nb9M20oF8HfFbdHI5/Vly0USx6mE70VWzwZvwq+6NxbRAGi6jWMpoi2sFg5iz3cdKS/pLjuUdZb7pHnwgqAu"
    "+MzN94mKIAm78FiEhPk4RmoR8r3EospAIVei8f1GvFdFDR23Q5NnAv0gWu93dZM1hxStxshbYnW2fe6Io2GuB4r9lVpPyCTMpst2KQhj1/KJrNB4zRsyRa7B"
    "roZFW6uKPThVYUCDId8ZNFVWWo6xL1gzZpSRq35X8LfypS3NG9oCh8WxlW+czP/l0JS3/rnwSoAqaEDbeKUV4WhBY6z39rGxV3tjE4rJQ2KWY6CnjX6X1xkF"
    "nkHLyPfDjk1s0/9m8e0k/aKDlZNE4b+zY98SpuUEEdCpZppkTveYZgruz4n8IhNZc4FnPL8ZWeLsPeq8DRKM85huiiXPl0w1bziO1/fA5d8WP6+do8/q6Sb3"
    "HM23bhpMzudhvZ/pI7scC0ZvBj+xy/HQdVdMSnXfiTPT03KblcqqH65qFfYsk586oeN33uw4iGD5pX75PAh/Ht0EE6MtNdGo5mqI8sYFevAr3RPUxEk2PmJ9"
    "kcvdk6hBHyE1jogrYjrmClXsmIRkpy1sP+GOzqcBw7mcUeeG0zeHXFrvB+RnzRfDWaASMwFLObvFOrndDvPUn7Yoq3yM5kPp81Czbtd5Mb57rDn1o8d9dTPW"
    "STXn35JaUK9EMYfcpxjxDutscRwEd7ac2VCz7Hs8P2dKxnnE7mQJ7GfqDp2OfKzuSSHjabw7ZgW0cISBFNFib97b9Mb1mQpqB23Ro49dG5sQ6Ge5QUfymMad"
    "n2iC1X2cBvkEKsf8sVTnvpsVbT8MT0/wE+kpor7I010G4ee64VcQeXP/V9Q++RW3T6669opSuJAV8TSOdQmTc9rKJl6rEtnkZJVr+GVnmQXHjQMVu+QtIqQI"
    "fReHgFnfdJKT/rHv7YovNLLrwIEr455wu3IcClgbySo274oGtincI0acKuxZthReYzvRE4s1thLHuHmZLbC3qZx9QESWnWkz+oJ27QZhz3ED85LBP8ENCAWk"
    "BLRphfof0oA5ocyxrJsUN58o8nN+oOQDGci2q5b304vupGfvoZ12z5qGq1z/7K4zf5/Hx1+eOz18Z7XShXKaXWiMfmrJo4QODkgevnnFNoveAaz1qqWaBy3L"
    "To/UHdWWaB6KMzSe5mTZbXlQnFQPhsktad0pLinO0XkOVUJUca1nEpHOzEXuIFtpVjHqeQPY825YXZWHFGfu3ZZmq/8Lapj8yhr63gVzUQTrPV5bjwVfR8h2"
    "u5fREPPtXak5kWv2lLWZQ73Cl57ZJuKszATZdp2TwQLAoiVNy4en5+YU6SxyxKCp5SVp4BbjtLLr5QCNesS0aTaQZuIE1psiK1NynvAC94a9sgb35uTHj8XE"
    "Ao1dCu/eZWZbZOQs2xh1RUvgwBU9B/lAPqdAm5UUPDv95vRb+YtcZ4dqggKZcLEDuAiO3k5PevacSBZFOXPPYJGsDYgITuucaGN8mCpBs5XOkm9MV9eEpB2f"
    "dn1a3YQY9aKAoW4bHCKzmMxz3KjLwApwSMPLTCwSLUiR3V1xikt712RwKeU8ps/RKVMUanbmyyiDF8kCc/v8mE4SdTqkWNsD+12zvCkrWXY+jnPDy4MoxsJl"
    "TgRmPHlwnR2BsBkmhBIlnmINDmQEGjJ0NgGpIhZrm+UjUswnMEkXsXVjv6PHgq6J1WeSv0Yitgfc96LDZzSl8AEgNKrjBW0iBRCcMfd5UnlMcOh0MKMI3eZt"
    "lucFpiYrr4QGFp9rzJlBDgENgJa/Th7Ebca+nekU0imH2tNgvNAOShCOillJEML2IrTHriZhmhfsQfFzn8069FovzOSSU5Ol+PF0rrGE+QVulbzFrZxu2Q2L"
    "z2hnLXzwk2CwRjINbq9MIIc/tOI4WWa748qOmX1EPK6sVeE/VzU5TYR7sBwsAMPjHRBPLbF6HsuienQM3e1hNkmd+QCa53GCg+OWnYy+YBeVnmcnOR1xm+FM"
    "l54RJPwGwIe0rR+BQ2GTWGaxmWxndr8K023gySSIJ9T8pWBH6zEaj37NOBveombJB9JsnN0STnUMnLsK7CtRHB1Lz+if/we/kO/T"
)
