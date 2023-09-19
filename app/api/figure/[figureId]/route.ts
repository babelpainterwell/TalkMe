import prismadb from "@/lib/prismadb";
import { auth, currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, {params}: {params: {figureId: string}}) {
    try {
        const body = await req.json();
        const user = await currentUser();
        const {src, name, description, instructions, seed, categoryId} = body;

        if (!params.figureId) {
            return new NextResponse("Figure ID is required", {status: 400});
        }

        if (!user || !user.id || !user.firstName) {
            return new NextResponse("Unauthorized", {status: 401});
        }

        if (!src || !name || !description || !instructions || !seed || !categoryId) {
            return new NextResponse("Missing required fields", {status: 400});
        }

        // TODO: Check for subscription 

        const figure = await prismadb.figure.update({
            where: {
                id: params.figureId,
                userId: user.id,
            },
            data: {
                categoryId,
                userId: user.id,
                userName: user.firstName,
                src,
                name,
                description,
                instructions,
                seed
            }
        });

        return NextResponse.json(figure);
    } catch (error) {
        console.log("[FIGURE_PATCH]", error);
        return new NextResponse("Internal Error", {status: 500});
    }
}


export async function DELETE(
    request: Request,
    { params }: { params: { figureId: string } }
) {
    try {
        const { userId } = auth();

        if (!userId) {
            return new NextResponse("Unauthorized", {status: 401});
        }

        const figure = await prismadb.figure.delete({
            where: {
                userId,
                id: params.figureId,
            }
        });

        return NextResponse.json(figure);
    } catch (error) {
        console.log("[FIGURE_DELETE]", error);
        return new NextResponse("Internal Error", {status: 500});
    }
}
