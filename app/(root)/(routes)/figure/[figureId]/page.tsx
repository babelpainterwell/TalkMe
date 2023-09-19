import prismadb from "@/lib/prismadb";
import { FigureForm } from "./components/figure-form";
import { auth, redirectToSignIn } from "@clerk/nextjs";

interface FigureIdPageProps {
    params: {
        figureId: string;
    };
};

const FigureIdPage = async ({
    params
}: FigureIdPageProps) => {
    const {userId} = auth();

    // TODO Check subscription 

    if (!userId) {
        return redirectToSignIn();
    }

    const figure = await prismadb.figure.findUnique({
        where: {
            id: params.figureId,
            userId
        }
    });

    const categories = await prismadb.category.findMany();

    return ( 
        <FigureForm 
        initialData={figure}
        categories={categories}
        />
     );
}
 
export default FigureIdPage;