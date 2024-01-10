import SDK from '@atala/prism-wallet-sdk'
import { RxDocument, KeyFunctionMap, RxCollection } from 'rxdb'
import { StaticRxCollectionContext } from '../../types'


export interface MessageSchemaType {
    readonly body: string
    readonly id: string
    readonly piuri: string
    readonly from?: string | undefined
    readonly to?: string | undefined
    readonly attachments: SDK.Domain.AttachmentDescriptor[]
    readonly thid?: string
    readonly extraHeaders: string[]
    readonly createdTime: string
    readonly expiresTimePlus: string
    readonly ack: string[]
    readonly direction: SDK.Domain.MessageDirection
    readonly fromPrior?: string | undefined
    readonly pthid?: string | undefined
}

export type MessageDocument = RxDocument<MessageSchemaType, MessageMethodTypes>

export interface MessageMethodTypes extends KeyFunctionMap {
    toDomainMessage: (
        this: MessageDocument
    ) => SDK.Domain.Message
}

export interface MessageStaticMethodTypes extends KeyFunctionMap {
    getMessage(
        this: StaticRxCollectionContext<{
            messages: MessageColletion
        }>,
        id: string
    ): Promise<SDK.Domain.Message | null>
    storeMessage(
        this: StaticRxCollectionContext<{
            messages: MessageColletion
        }>,
        message: SDK.Domain.Message
    ): Promise<void>
    storeMessages(
        this: StaticRxCollectionContext<{
            messages: MessageColletion
        }>,
        messages: SDK.Domain.Message[]
    ): Promise<void>
    getAllMessages(
        this: StaticRxCollectionContext<{
            messages: MessageColletion
        }>
    ): Promise<SDK.Domain.Message[]>
    getAllMessagesByFromToDID(
        this: StaticRxCollectionContext<{
            messages: MessageColletion
        }>,
        from: SDK.Domain.DID,
        to: SDK.Domain.DID
    ): Promise<SDK.Domain.Message[]>
    getAllMessagesOfType(
        this: StaticRxCollectionContext<{
            messages: MessageColletion
        }>,
        type: string,
        relatedWithDID?: SDK.Domain.DID | undefined
    ): Promise<SDK.Domain.Message[]>
    getAllMessagesReceivedFrom(
        this: StaticRxCollectionContext<{
            messages: MessageColletion
        }>,
        did: SDK.Domain.DID
    ): Promise<SDK.Domain.Message[]>
    getAllMessagesSentTo(
        this: StaticRxCollectionContext<{
            messages: MessageColletion
        }>,
        did: SDK.Domain.DID
    ): Promise<SDK.Domain.Message[]>
    getAllMessagesReceived(
        this: StaticRxCollectionContext<{
            messages: MessageColletion
        }>
    ): Promise<SDK.Domain.Message[]>
    getAllMessagesSent(
        this: StaticRxCollectionContext<{
            messages: MessageColletion
        }>
    ): Promise<SDK.Domain.Message[]>
    getAllMessagesByDID(
        this: StaticRxCollectionContext<{
            messages: MessageColletion
        }>,
        did: SDK.Domain.DID
    ): Promise<SDK.Domain.Message[]>
}

export type MessageColletion = RxCollection<
    MessageSchemaType,
    MessageMethodTypes,
    MessageStaticMethodTypes
>