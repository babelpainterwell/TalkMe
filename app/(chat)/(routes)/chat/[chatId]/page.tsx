import prismadb from "@/lib/prismadb";
import { auth, redirectToSignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { ChatClient } from "./components/client";

interface ChatIdPageProps {
    params: {
        chatId: string;
    }
}


const ChatIdPage = async ({
    params
}: ChatIdPageProps) => {
    const { userId } = auth();

    if (!userId) {
        return redirectToSignIn();
    }

    const figure = await prismadb.figure.findUnique({
        where: {
            id: params.chatId
        },
        include: {
            messages: {
                orderBy: {
                    createdAt: "asc",
                },
                where: {
                    userId,
                }
            },
            _count: {
                select: {
                    messages: true
                }
            }
        }
    });

    if (!figure) {
        return redirect("/");
    }

    return ( 
        <ChatClient figure={figure} />
    );
}
 
export default ChatIdPage; 